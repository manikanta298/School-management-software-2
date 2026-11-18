import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
// 3.1 Staff attendance + documents + teacher workload.
export async function attendanceList(schoolId,query){
 const values=[schoolId],filters=['a.school_id=$1'];
 if(query.from){values.push(query.from);filters.push(`a.attendance_date>=$${values.length}`);}
 if(query.to){values.push(query.to);filters.push(`a.attendance_date<=$${values.length}`);}
 if(query.staff_id){values.push(query.staff_id);filters.push(`a.staff_id=$${values.length}`);}
 values.push(query.limit,query.offset);
 return (await pool.query(`SELECT a.id,a.staff_id,a.attendance_date::text AS attendance_date,a.status,a.note,a.recorded_by,s.name AS staff_name,s.employee_number FROM staff_attendance a JOIN staff_members s ON s.id=a.staff_id WHERE ${filters.join(' AND ')} ORDER BY a.attendance_date DESC,a.id LIMIT $${values.length-1} OFFSET $${values.length}`,values)).rows;
}
export async function saveAttendance(schoolId,userId,data){
 const {rows:[row]}=await pool.query('INSERT INTO staff_attendance(school_id,staff_id,attendance_date,status,note,recorded_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(staff_id,attendance_date) DO UPDATE SET status=excluded.status,note=excluded.note,recorded_by=excluded.recorded_by,updated_at=now() RETURNING id,attendance_date::text AS attendance_date,status,note',[schoolId,data.staff_id,data.attendance_date,data.status,data.note||null,userId]);
 return row;
}
export async function documents(schoolId,staffId){
 return (await pool.query('SELECT d.id,d.name,d.mime,octet_length(d.bytea) AS size,d.created_at::text AS created_at,u.name AS uploaded_by_name FROM staff_documents d JOIN users u ON u.id=d.uploaded_by WHERE d.school_id=$1 AND d.staff_id=$2 ORDER BY d.created_at DESC',[schoolId,staffId])).rows;
}
export async function addDocument(schoolId,staffId,userId,name,mime,buffer){
 const {rows:[row]}=await pool.query('INSERT INTO staff_documents(school_id,staff_id,name,mime,bytea,uploaded_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,mime,octet_length(bytea) AS size,created_at::text AS created_at',[schoolId,staffId,name,mime,buffer,userId]);
 return row;
}
export async function documentBytes(schoolId,docId){
 const {rows:[row]}=await pool.query('SELECT bytea,mime,name FROM staff_documents WHERE id=$1 AND school_id=$2',[docId,schoolId]);
 return row||null;
}
export async function workload(schoolId,teacherId){
 const {rows:[t]}=await pool.query('SELECT t.id,u.name,t.employee_number,t.employment_status FROM teachers t JOIN users u ON u.id=t.user_id WHERE t.id=$1 AND t.school_id=$2',[teacherId,schoolId]);
 if(!t)throw fail(404,'Teacher not found in this school');
 const assignments=await pool.query('SELECT a.id,a.class_id,a.subject_id,c.name AS class_name,sub.name AS subject_name FROM teacher_assignments a JOIN classes c ON c.id=a.class_id LEFT JOIN subjects sub ON sub.id=a.subject_id WHERE a.teacher_id=$1 AND a.school_id=$2',[teacherId,schoolId]);
 const periods=await pool.query(`SELECT count(*)::int AS weekly_periods, count(DISTINCT ts.section_id)::int AS sections FROM timetable_slots ts WHERE ts.teacher_id=$1 AND ts.school_id=$2 AND ts.active=true`,[teacherId,schoolId]);
 return {teacher:t,assignments:assignments.rows,weekly_periods:periods.rows[0].weekly_periods,sections:periods.rows[0].sections};
}
