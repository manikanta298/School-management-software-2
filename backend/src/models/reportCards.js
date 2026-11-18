import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
// Acting-user scoping: admin = school-wide; teacher = sections they teach; parent = linked children; student = self.
// values is pre-populated by the caller; schoolId and (for non-admin) user.id are appended in that order.
function studentScope(user,schoolId,values){
 values.push(schoolId);
 const schoolPos=values.length;
 if(user.role==='admin')return `s.school_id=$${schoolPos}`;
 values.push(user.id);
 const userPos=values.length;
 if(user.role==='student')return `s.school_id=$${schoolPos} AND s.user_id=$${userPos}`;
 if(user.role==='parent')return `s.school_id=$${schoolPos} AND EXISTS(SELECT 1 FROM student_parents sp JOIN parents p ON p.id=sp.parent_id AND p.school_id=sp.school_id WHERE sp.student_id=s.id AND p.user_id=$${userPos})`;
 if(user.role==='teacher')return `s.school_id=$${schoolPos} AND EXISTS(SELECT 1 FROM teacher_assignments a JOIN sections sec ON sec.id=a.section_id AND sec.school_id=s.school_id WHERE a.teacher_id=$${userPos} AND a.school_id=s.school_id AND (sec.class_id IN (SELECT e.class_id FROM enrollments e WHERE e.student_id=s.id AND e.status='active') OR EXISTS(SELECT 1 FROM enrollments e WHERE e.student_id=s.id AND e.section_id=a.section_id AND e.status='active')))`;
 return `s.school_id=$${schoolPos}`;
}
export async function list(user,schoolId,query){
 const values=[],filters=[studentScope(user,schoolId,values)];
 if(query.academic_year_id){values.push(query.academic_year_id);filters.push(`EXISTS(SELECT 1 FROM enrollments e WHERE e.student_id=s.id AND e.school_id=s.school_id AND e.academic_year_id=$${values.length} AND e.status='active')`);}
 if(query.section_id){values.push(query.section_id);filters.push(`EXISTS(SELECT 1 FROM enrollments e WHERE e.student_id=s.id AND e.school_id=s.school_id AND e.section_id=$${values.length} AND e.status='active')`);}
 values.push(query.limit,query.offset);
 return (await pool.query(`SELECT s.id,s.admission_number,u.name,u.email,c.name AS class_name,sec.name AS section_name,y.name AS academic_year_name FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN LATERAL(SELECT e.* FROM enrollments e WHERE e.student_id=s.id AND e.school_id=s.school_id AND e.status='active' ORDER BY e.enrolled_on DESC LIMIT 1) e ON true LEFT JOIN classes c ON c.id=e.class_id LEFT JOIN sections sec ON sec.id=e.section_id LEFT JOIN academic_years y ON y.id=e.academic_year_id WHERE ${filters.join(' AND ')} ORDER BY u.name,s.id LIMIT $${values.length-1} OFFSET $${values.length}`,values)).rows;
}
export async function detail(user,schoolId,studentId,academicYearId){
 // params: $1=studentId, $2=academicYearId, then studentScope pushes schoolId at the next index.
 const values=[studentId,academicYearId];
 const scope=studentScope(user,schoolId,values); // pushes schoolId; values is now [studentId, academicYearId, schoolId]
 const sidPos=1, ayPos=2;
 const {rows:[s]}=await pool.query(`SELECT s.id,s.admission_number,u.name,u.email,c.name AS class_name,sec.name AS section_name,y.id AS academic_year_id,y.name AS academic_year_name FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN LATERAL(SELECT en.class_id,en.section_id,en.academic_year_id FROM enrollments en WHERE en.student_id=s.id AND en.school_id=s.school_id AND en.academic_year_id=$${ayPos} AND en.status='active' ORDER BY en.enrolled_on DESC LIMIT 1) z ON true LEFT JOIN classes c ON c.id=z.class_id LEFT JOIN sections sec ON sec.id=z.section_id LEFT JOIN academic_years y ON y.id=z.academic_year_id WHERE s.id=$${sidPos} AND ${scope}`,values);
 if(!s)throw fail(404,'Student not found in this scope');
 const results=await pool.query(`SELECT ex.id,ex.name,ex.status,paper.id AS paper_id,paper.subject_id,sub.name AS subject_name,paper.max_marks,paper.pass_marks,m.outcome,m.score,m.remark FROM exams ex JOIN exam_papers paper ON paper.exam_id=ex.id AND paper.school_id=ex.school_id LEFT JOIN subjects sub ON sub.id=paper.subject_id LEFT JOIN exam_marks m ON m.paper_id=paper.id AND m.student_id=$1 AND m.school_id=ex.school_id WHERE ex.school_id=$2 AND ex.status='published' AND EXISTS(SELECT 1 FROM exam_candidates c WHERE c.exam_id=ex.id AND c.student_id=$1 AND c.school_id=ex.school_id) ORDER BY ex.id,paper.id`,[studentId,schoolId]);
 const remarks=await pool.query('SELECT id,term,remark,author_id,created_at,updated_at FROM report_card_remarks WHERE student_id=$1 AND school_id=$2 AND academic_year_id=$3 ORDER BY term,updated_at',[studentId,schoolId,academicYearId]);
 const attendance=await pool.query(`SELECT count(*) FILTER(WHERE ae.status='present')::int AS present, count(*)::int AS total FROM attendance_entries ae JOIN attendance_registers ar ON ar.id=ae.register_id WHERE ae.student_id=$1 AND ar.school_id=$2 AND ar.academic_year_id=$3 AND ae.status<>'void'`,[studentId,schoolId,academicYearId]);
 return {student:s,exam_results:results.rows,remarks:remarks.rows,attendance:attendance.rows[0]};
}
export async function upsertRemark(schoolId,studentId,userId,data){
 const {rows:[row]}=await pool.query(`INSERT INTO report_card_remarks(school_id,student_id,academic_year_id,term,remark,author_id) VALUES($1,$2,$3,$4,$5,$6)
  ON CONFLICT(student_id,academic_year_id,term) DO UPDATE SET remark=excluded.remark,author_id=excluded.author_id,updated_at=now()
  RETURNING id,term,remark,author_id,created_at,updated_at`,[schoolId,studentId,data.academic_year_id,data.term,data.remark,userId]);
 return row;
}
