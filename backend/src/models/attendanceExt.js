import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
// 3.2 Attendance enhancements: alerts, monthly report, corrections queue.
export async function alerts(schoolId,query){
 const values=[schoolId],filters=['ar.school_id=$1'];
 if(query.from){values.push(query.from);filters.push(`ar.attendance_date>=$${values.length}`);}
 if(query.to){values.push(query.to);filters.push(`ar.attendance_date<=$${values.length}`);}
 if(query.section_id){values.push(query.section_id);filters.push(`ar.section_id=$${values.length}`);}
 values.push(query.threshold);
 return (await pool.query(`SELECT s.id AS student_id,u.name AS student_name,s.admission_number,sec.name AS section_name,
  count(*) FILTER(WHERE ae.status='absent')::int AS absent_count,
  count(*)::int AS total,
  round(count(*) FILTER(WHERE ae.status='absent')::float / nullif(count(*),0) * 100) AS absent_pct
  FROM attendance_entries ae JOIN attendance_registers ar ON ar.id=ae.register_id JOIN students s ON s.id=ae.student_id JOIN users u ON u.id=s.user_id LEFT JOIN sections sec ON sec.id=ar.section_id
  WHERE ${filters.join(' AND ')} AND ae.status<>'void'
  GROUP BY s.id,u.name,s.admission_number,sec.name
  HAVING count(*) FILTER(WHERE ae.status='absent')::float / nullif(count(*),0) * 100 >= $${values.length}
  ORDER BY absent_pct DESC,s.admission_number`,values)).rows;
}
export async function monthly(schoolId,query){
 const values=[schoolId,query.section_id,query.month+'-01'];
 return (await pool.query(`SELECT to_char(ar.attendance_date,'YYYY-MM-DD') AS date,
  count(*) FILTER(WHERE ae.status='present')::int AS present,
  count(*) FILTER(WHERE ae.status='absent')::int AS absent,
  count(*) FILTER(WHERE ae.status='late')::int AS late,
  count(*) FILTER(WHERE ae.status='excused')::int AS excused,
  count(*)::int AS total
  FROM attendance_entries ae JOIN attendance_registers ar ON ar.id=ae.register_id
  WHERE ar.school_id=$1 AND ar.section_id=$2 AND to_char(ar.attendance_date,'YYYY-MM')=to_char($3::date,'YYYY-MM') AND ae.status<>'void'
  GROUP BY ar.attendance_date ORDER BY ar.attendance_date`,values)).rows;
}
export async function listCorrections(schoolId,query){
 const values=[schoolId],filters=['c.school_id=$1'];
 if(query.status){values.push(query.status);filters.push(`c.status=$${values.length}`);}
 values.push(query.limit,query.offset);
 return (await pool.query(`SELECT c.id,c.student_id,c.attendance_date::text AS attendance_date,c.requested_status,c.reason,c.status,c.requested_at::text AS requested_at,u.name AS requested_by_name,c.reviewed_at::text AS reviewed_at,c.review_note FROM attendance_corrections c JOIN users u ON u.id=c.requested_by WHERE ${filters.join(' AND ')} ORDER BY c.requested_at DESC,c.id LIMIT $${values.length-1} OFFSET $${values.length}`,values)).rows;
}
export async function createCorrection(schoolId,userId,data){
 const {rows:[row]}=await pool.query('INSERT INTO attendance_corrections(school_id,student_id,attendance_date,requested_status,reason,requested_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,attendance_date::text AS attendance_date,requested_status,reason,status,requested_at::text AS requested_at',[schoolId,data.student_id,data.attendance_date,data.requested_status,data.reason,userId]);
 return row;
}
export async function reviewCorrection(schoolId,id,userId,decision,note){
 const allowed=['approved','rejected'];
 if(!allowed.includes(decision))throw fail(400,'Invalid decision');
 const {rows:[row]}=await pool.query('UPDATE attendance_corrections SET status=$3,reviewed_by=$4,reviewed_at=now(),review_note=$5 WHERE id=$1 AND school_id=$2 AND status=\'pending\' RETURNING id,status,reviewed_at::text AS reviewed_at',[id,schoolId,decision,userId,note||null]);
 if(!row)throw fail(409,'Correction not found or already reviewed');
 return row;
}
