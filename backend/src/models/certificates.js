import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
import * as settings from '../services/settings.js';
export async function list(schoolId,query){
 const values=[schoolId],filters=['c.school_id=$1'];
 if(query.student_id){values.push(query.student_id);filters.push(`c.student_id=$${values.length}`);}
 if(query.type){values.push(query.type);filters.push(`c.type=$${values.length}`);}
 values.push(query.limit,query.offset);
 return (await pool.query(`SELECT c.id,c.certificate_number,c.type,c.student_id,c.issued_at::text AS issued_at,c.voided_at IS NOT NULL AS voided,c.voided_at::text AS voided_at,c.void_reason,c.superseded_by,u.name AS issued_by_name,s.admission_number,stu.name AS student_name FROM certificates_issued c JOIN users u ON u.id=c.issued_by JOIN students s ON s.id=c.student_id JOIN users stu ON stu.id=s.user_id WHERE ${filters.join(' AND ')} ORDER BY c.issued_at DESC,c.id LIMIT $${values.length-1} OFFSET $${values.length}`,values)).rows;
}
export async function find(schoolId,id){
 const {rows:[c]}=await pool.query(`SELECT c.id,c.certificate_number,c.type,c.student_id,c.issued_at,c.voided_at,c.voided_by,c.void_reason,c.superseded_by,c.snapshot,u.name AS issued_by_name,s.admission_number,stu.name AS student_name,stu.email AS student_email,(c.voided_at IS NOT NULL) AS voided FROM certificates_issued c JOIN users u ON u.id=c.issued_by JOIN students s ON s.id=c.student_id JOIN users stu ON stu.id=s.user_id WHERE c.id=$1 AND c.school_id=$2`,[id,schoolId]);
 if(!c)throw fail(404,'Certificate not found');
 const profile=await settings.publicProfile(schoolId);
 return {...c,profile};
}
export async function issue(schoolId,userId,data){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  // Lock the student row so we cannot issue a certificate for a student of another school.
  const {rows:[s]}=await c.query(`SELECT s.id,u.name,u.email,s.admission_number,s.admission_date::text AS admission_date,s.lifecycle_status FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.school_id=$2 FOR SHARE OF s`,[data.student_id,schoolId]);
  if(!s)throw fail(404,'Student not found in this school');
  const profile=await settings.publicProfile(schoolId);
  const snapshot=JSON.stringify({student:s,profile,reason:data.reason,issued_at:new Date().toISOString()});
  const {rows:[row]}=await c.query('INSERT INTO certificates_issued(school_id,type,student_id,issued_by,snapshot) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id,certificate_number,issued_at::text AS issued_at',[schoolId,data.type,data.student_id,userId,snapshot]);
  await c.query('COMMIT');
  return find(schoolId,row.id);
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function void_(schoolId,id,userId,reason){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const {rows:[row]}=await c.query('UPDATE certificates_issued SET voided_at=now(),voided_by=$3,void_reason=$4 WHERE id=$1 AND school_id=$2 AND voided_at IS NULL RETURNING id,certificate_number',[id,schoolId,userId,reason]);
  if(!row)throw fail(409,'Certificate not found or already voided');
  await c.query('COMMIT');
  return find(schoolId,id);
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
