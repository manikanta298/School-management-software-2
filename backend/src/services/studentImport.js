import { pool } from '../config/db.js';
import { fail,hashPassword } from './auth.js';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import * as model from '../models/students.js';

// Import schema (BATCH_1_HANDOFF.md §2.8). Each row carries: admission_number, name, email, optional
// date_of_birth + profile fields. All-or-nothing unless dry_run. Per D4, each student gets a one-time
// temporary password and the API returns a single-use CSV-friendly list of credentials.
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;},'Invalid calendar date');
const rowSchema=z.object({
 admission_number:z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{1,30}$/),
 name:z.string().trim().min(1).max(100),
 email:z.string().trim().toLowerCase().email().max(254),
 admission_date:date,
 date_of_birth:date.nullable().optional(),
 gender:z.enum(['female','male','other']).nullable().optional(),
 blood_group:z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).nullable().optional(),
 address:z.string().trim().max(500).nullable().optional()
}).strict();
export const importBody=z.object({
 dry_run:z.boolean().default(true),
 rows:z.array(rowSchema).min(1).max(200)
}).strict();

export async function import_(schoolId,userId,{rows,dry_run}){
 const seenNum=new Set(),seenEmail=new Set();
 const results=rows.map((raw,i)=>{const errors=[];if(seenNum.has(raw.admission_number))errors.push('admission_number: duplicated in this file');if(seenEmail.has(raw.email))errors.push('email: duplicated in this file');seenNum.add(raw.admission_number);seenEmail.add(raw.email);return {row:i+1,...raw,errors};});
 const numbers=results.map(r=>r.admission_number),emails=results.map(r=>r.email);
 const existing=new Map((await pool.query('SELECT admission_number,email FROM students s JOIN users u ON u.id=s.user_id WHERE s.school_id=$1 AND (s.admission_number=ANY($2::text[]) OR u.email=ANY($3::text[]))',[schoolId,numbers,emails])).rows.map(r=>[r.admission_number,r.email]));
 for(const r of results){const exNum=existing.get(r.admission_number),exEmail=existing.get(r.email);if(exNum||exEmail){if(exNum)r.errors.push('admission_number: already exists');if(exEmail)r.errors.push('email: already exists');}}
 const valid=results.every(r=>!r.errors.length);
 let credentials=[];
 if(valid&&!dry_run){
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   for(const r of results){
    const pw=randomBytes(9).toString('base64url')+'Aa1!';
    const hash=await hashPassword(pw);
    const {rows:[u]}=await c.query("INSERT INTO users(name,email,password_hash,role,active,must_change_password) VALUES($1,$2,$3,'student',true,true) RETURNING id",[r.name,r.email,hash]);
    await c.query('INSERT INTO school_memberships(school_id,user_id,role,status,is_default) VALUES($1,$2,$3,$4,$5)',[schoolId,u.id,'student','active',false]);
    const {rows:[s]}=await c.query('INSERT INTO students(school_id,user_id,admission_number,admission_date,date_of_birth,address,gender,blood_group) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[schoolId,u.id,r.admission_number,r.admission_date,r.date_of_birth||null,r.address||null,r.gender||null,r.blood_group||null]);
    credentials.push({admission_number:r.admission_number,email:r.email,temporary_password:pw,student_id:s.id});
   }
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');if(e.code==='23505')throw fail(409,'Duplicate admission_number or email after re-check');throw e;}finally{c.release();}
 }
 return {applied:valid&&!dry_run,valid,results:results.map(({row,admission_number,email,errors})=>({row,admission_number,email,errors})),credentials};
}

export async function profile(user,schoolId,studentId){
 const student=await model.find('students',user,schoolId,studentId);
 if(!student)throw fail(404,'Student not found');
 const [parents,enrollments,attendance,fees,homework,transport]=await Promise.all([
  pool.query('SELECT p.id,u.name,p.phone,u.email,sp.relationship FROM student_parents sp JOIN parents p ON p.id=sp.parent_id AND p.school_id=sp.school_id JOIN users u ON u.id=p.user_id WHERE sp.student_id=$1 AND sp.school_id=$2',[studentId,schoolId]),
  pool.query('SELECT e.id,y.name AS academic_year_name,c.name AS class_name,sec.name AS section_name,e.enrolled_on::text AS enrolled_on,e.status FROM enrollments e JOIN academic_years y ON y.id=e.academic_year_id JOIN classes c ON c.id=e.class_id JOIN sections sec ON sec.id=e.section_id WHERE e.student_id=$1 AND e.school_id=$2 ORDER BY e.enrolled_on DESC',[studentId,schoolId]),
  pool.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE status='present')::int AS present,count(*) FILTER(WHERE status='absent')::int AS absent FROM attendance_entries ae WHERE ae.student_id=$1 AND ae.status<>'void' AND EXISTS(SELECT 1 FROM attendance_registers ar WHERE ar.id=ae.register_id AND ar.school_id=$2)`,[studentId,schoolId]),
  pool.query(`SELECT i.id,i.invoice_number,i.title,i.amount_minor,i.currency,i.voided_at IS NOT NULL AS voided,coalesce((SELECT sum(amount_minor) FROM fee_payments p WHERE p.invoice_id=i.id AND p.reversed_at IS NULL),0)::bigint AS paid_minor FROM fee_invoices i WHERE i.student_id=$1 AND i.school_id=$2 ORDER BY i.issued_on DESC LIMIT 20`,[studentId,schoolId]),
  pool.query(`SELECT h.id,h.title,h.due_on::text AS due_on,h.archived_at IS NOT NULL AS archived FROM homework h WHERE h.school_id=$1 AND h.section_id IN (SELECT e.section_id FROM enrollments e WHERE e.student_id=$2 AND e.status='active') ORDER BY h.due_on DESC LIMIT 10`,[schoolId,studentId]),
  pool.query(`SELECT a.id,v.registration_number AS vehicle,r.name AS route_name,a.created_at::text AS allocated_on FROM transport_allocations a JOIN transport_stops s ON s.id=a.stop_id JOIN transport_routes r ON r.id=s.route_id LEFT JOIN transport_vehicles v ON v.id=r.vehicle_id WHERE a.student_id=$1 AND EXISTS(SELECT 1 FROM transport_stops ss JOIN transport_routes rr ON rr.id=ss.route_id WHERE ss.id=a.stop_id AND rr.school_id=$2)`,[studentId,schoolId])
 ]);
 return {student,parents:parents.rows,enrollments:enrollments.rows,attendance_summary:attendance.rows[0],fees:fees.rows,homework:homework.rows,transport:transport.rows};
}
