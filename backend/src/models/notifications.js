import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
// §2.2 student documents — tenant-scoped upload/list/download.
export async function list(schoolId,studentId){
 return (await pool.query('SELECT d.id,d.name,d.mime,octet_length(d.bytea) AS size,d.created_at::text AS created_at,u.name AS uploaded_by_name FROM student_documents d JOIN users u ON u.id=d.uploaded_by WHERE d.school_id=$1 AND d.student_id=$2 ORDER BY d.created_at DESC',[schoolId,studentId])).rows;
}
export async function add(schoolId,studentId,userId,name,mime,buffer){
 const {rows:[row]}=await pool.query('INSERT INTO student_documents(school_id,student_id,name,mime,bytea,uploaded_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,mime,octet_length(bytea) AS size,created_at::text AS created_at',[schoolId,studentId,name,mime,buffer,userId]);
 return row;
}
export async function bytes(schoolId,docId){
 const {rows:[row]}=await pool.query('SELECT bytea,mime,name,student_id FROM student_documents WHERE id=$1 AND school_id=$2',[docId,schoolId]);
 return row||null;
}
// §2.13 notification outbox enqueue. Provider delivery is P2; this just records the intent.
export async function enqueue(schoolId,{event_type,channel,recipient_ref,template_key,payload_ref=null}){
 const {rows:[row]}=await pool.query('INSERT INTO notification_outbox(school_id,event_type,channel,recipient_ref,template_key,payload_ref) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,status,created_at::text AS created_at',[schoolId,event_type,channel,recipient_ref,template_key,payload_ref]);
 return row;
}
export async function listOutbox(schoolId,query){
 const values=[schoolId],filters=['o.school_id=$1'];
 if(query.status){values.push(query.status);filters.push(`o.status=$${values.length}`);}
 if(query.event_type){values.push(query.event_type);filters.push(`o.event_type=$${values.length}`);}
 values.push(query.limit,query.offset);
 return (await pool.query(`SELECT o.id,o.event_type,o.channel,o.recipient_ref,o.template_key,o.status,o.attempt_count,o.created_at::text AS created_at,o.sent_at::text AS sent_at,o.last_error_code FROM notification_outbox o WHERE ${filters.join(' AND ')} ORDER BY o.created_at DESC,o.id LIMIT $${values.length-1} OFFSET $${values.length}`,values)).rows;
}
