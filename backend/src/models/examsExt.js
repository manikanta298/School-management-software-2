import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
// 3.4 Exam types, class ranks, principal remarks.
export async function types(schoolId){
 return (await pool.query('SELECT id,name,code FROM exam_types WHERE school_id=$1 ORDER BY name',[schoolId])).rows;
}
export async function saveType(schoolId,id,data){
 if(id){const {rows:[row]}=await pool.query('UPDATE exam_types SET name=$2,code=$3 WHERE id=$1 AND school_id=$4 RETURNING id,name,code',[id,data.name,data.code,schoolId]);return row;}
 const {rows:[row]}=await pool.query('INSERT INTO exam_types(school_id,name,code) VALUES($1,$2,$3) RETURNING id,name,code',[schoolId,data.name,data.code]);
 return row;
}
export async function ranks(schoolId,examId){
 const {rows:[ex]}=await pool.query('SELECT id FROM exams WHERE id=$1 AND school_id=$2',[examId,schoolId]);
 if(!ex)throw fail(404,'Exam not found in this school');
 return (await pool.query(`SELECT m.student_id,u.name AS student_name,s.admission_number,
   sum(CASE WHEN m.outcome='scored' THEN m.score ELSE 0 END) AS total_score,
   sum(p.max_marks) AS max_total,
   round(sum(CASE WHEN m.outcome='scored' THEN m.score ELSE 0 END)::numeric / nullif(sum(p.max_marks),0) * 100, 2) AS percentage,
   rank() OVER (ORDER BY sum(CASE WHEN m.outcome='scored' THEN m.score ELSE 0 END) DESC) AS rank
   FROM exam_marks m JOIN exam_papers p ON p.id=m.paper_id AND p.school_id=m.school_id JOIN students s ON s.id=m.student_id JOIN users u ON u.id=s.user_id
   WHERE m.exam_id=$1 AND m.school_id=$2
   GROUP BY m.student_id,u.name,s.admission_number
   ORDER BY rank,u.name`,[examId,schoolId])).rows;
}
export async function upsertRemark(schoolId,examId,studentId,userId,remark){
 const {rows:[row]}=await pool.query(`INSERT INTO exam_student_remarks(school_id,exam_id,student_id,remark,author_id) VALUES($1,$2,$3,$4,$5)
  ON CONFLICT(exam_id,student_id) DO UPDATE SET remark=excluded.remark,author_id=excluded.author_id,updated_at=now()
  RETURNING id,remark,author_id,created_at,updated_at`,[schoolId,examId,studentId,remark,userId]);
 return row;
}
export async function listRemarks(schoolId,examId){
 return (await pool.query(`SELECT r.id,r.student_id,r.remark,r.author_id,r.created_at,r.updated_at,u.name AS author_name FROM exam_student_remarks r JOIN users u ON u.id=r.author_id WHERE r.school_id=$1 AND r.exam_id=$2 ORDER BY r.updated_at DESC`,[schoolId,examId])).rows;
}
