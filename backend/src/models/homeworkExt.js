import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
// 3.3 Homework attachments + submissions + feedback.
export async function attachments(schoolId,homeworkId){
 return (await pool.query('SELECT a.id,a.name,a.mime,octet_length(a.bytea) AS size,a.created_at::text AS created_at,u.name AS uploaded_by_name FROM homework_attachments a JOIN users u ON u.id=a.uploaded_by WHERE a.school_id=$1 AND a.homework_id=$2 ORDER BY a.created_at',[schoolId,homeworkId])).rows;
}
export async function addAttachment(schoolId,homeworkId,userId,name,mime,buffer){
 const {rows:[row]}=await pool.query('INSERT INTO homework_attachments(school_id,homework_id,name,mime,bytea,uploaded_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,mime,octet_length(bytea) AS size,created_at::text AS created_at',[schoolId,homeworkId,name,mime,buffer,userId]);
 return row;
}
export async function attachmentBytes(schoolId,homeworkId,attachId){
 const {rows:[row]}=await pool.query('SELECT bytea,mime,name FROM homework_attachments WHERE id=$1 AND homework_id=$2 AND school_id=$3',[attachId,homeworkId,schoolId]);
 return row||null;
}
export async function submissions(schoolId,homeworkId){
 return (await pool.query(`SELECT s.id,s.student_id,s.name,s.mime,octet_length(s.bytea) AS size,s.note,s.submitted_at::text AS submitted_at,s.feedback,s.feedback_at::text AS feedback_at,u.name AS student_name FROM homework_submissions s JOIN students st ON st.id=s.student_id JOIN users u ON u.id=st.user_id WHERE s.school_id=$1 AND s.homework_id=$2 ORDER BY s.submitted_at DESC`,[schoolId,homeworkId])).rows;
}
export async function addSubmission(schoolId,homeworkId,studentId,userId,name,mime,buffer,note){
 const {rows:[row]}=await pool.query(`INSERT INTO homework_submissions(school_id,homework_id,student_id,name,mime,bytea,note) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(homework_id,student_id) DO UPDATE SET name=excluded.name,mime=excluded.mime,bytea=excluded.bytea,note=excluded.note,submitted_at=now(),feedback=null,feedback_by=null,feedback_at=null RETURNING id,student_id,name,mime,octet_length(bytea) AS size,note,submitted_at::text AS submitted_at`,[schoolId,homeworkId,studentId,name,mime,buffer,note||null]);
 return row;
}
export async function feedback(schoolId,homeworkId,studentId,userId,text){
 const {rows:[row]}=await pool.query(`UPDATE homework_submissions SET feedback=$4,feedback_by=$5,feedback_at=now() WHERE homework_id=$1 AND student_id=$2 AND school_id=$3 RETURNING id,feedback,feedback_at::text AS feedback_at`,[homeworkId,studentId,schoolId,text,userId]);
 if(!row)throw fail(404,'Submission not found');
 return row;
}
