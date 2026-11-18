import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
import * as notices from './notices.js';
async function linkedChildren(parentUserId,schoolId){
 const {rows}=await pool.query(`SELECT s.id,s.admission_number,u.name FROM students s JOIN users u ON u.id=s.user_id JOIN student_parents sp ON sp.student_id=s.id JOIN parents p ON p.id=sp.parent_id AND p.school_id=sp.school_id WHERE p.user_id=$1 AND s.school_id=$2 AND s.lifecycle_status='active' ORDER BY u.name`,[parentUserId,schoolId]);
 return rows;
}
export async function children(parentUserId,schoolId){
 const kids=await linkedChildren(parentUserId,schoolId);
 const out=[];
 for(const k of kids){
  const [balance,attendance,unreadNotices,homework,exam]=await Promise.all([
   pool.query(`SELECT coalesce(sum(amount_minor - concessions - paid + penalties - refunds),0)::bigint AS outstanding FROM (SELECT i.amount_minor, coalesce((SELECT sum(amount_minor) FROM fee_concessions c WHERE c.invoice_id=i.id AND c.voided_at IS NULL),0) AS concessions, coalesce((SELECT sum(amount_minor) FROM fee_payments p WHERE p.invoice_id=i.id AND p.reversed_at IS NULL),0) AS paid, coalesce((SELECT sum(amount_minor) FROM fee_penalties pn WHERE pn.invoice_id=i.id),0) AS penalties, coalesce((SELECT sum(amount_minor) FROM fee_refunds r WHERE r.invoice_id=i.id),0) AS refunds FROM fee_invoices i WHERE i.student_id=$1 AND i.school_id=$2 AND i.voided_at IS NULL) i`,[k.id,schoolId]),
   pool.query(`SELECT count(*) FILTER(WHERE status='present')::float / nullif(count(*),0)::float * 100 AS pct FROM attendance_entries ae WHERE ae.student_id=$1 AND EXISTS(SELECT 1 FROM attendance_registers ar WHERE ar.id=ae.register_id AND ar.school_id=$2) AND ae.status<>'void' AND ae.attendance_date>=CURRENT_DATE-30`,[k.id,schoolId]),
   notices.unread({id:parentUserId,role:'parent',schoolId},pool),
   pool.query(`SELECT count(*)::int AS n FROM homework h WHERE h.school_id=$1 AND h.section_id IN (SELECT e.section_id FROM enrollments e WHERE e.student_id=$2 AND e.status='active') AND h.archived_at IS NULL AND h.due_on>=CURRENT_DATE`,[schoolId,k.id]),
   pool.query(`SELECT e.id,e.name,e.start_date::text AS start_date FROM exams e WHERE e.school_id=$1 AND e.status='published' AND e.end_date>=CURRENT_DATE AND EXISTS(SELECT 1 FROM exam_candidates c WHERE c.exam_id=e.id AND c.student_id=$2 AND c.school_id=e.school_id) ORDER BY e.start_date LIMIT 1`,[schoolId,k.id])
  ]);
  out.push({...k,outstanding_minor:balance.rows[0].outstanding,attendance_pct_30d:attendance.rows[0].pct,unread_notices:unreadNotices,pending_homework:homework.rows[0].n,next_exam:exam.rows[0]||null});
 }
 return out;
}
export async function overview(parentUserId,schoolId,studentId){
 // Verify linkage.
 const {rows:[link]}=await pool.query(`SELECT 1 FROM student_parents sp JOIN parents p ON p.id=sp.parent_id AND p.school_id=sp.school_id WHERE sp.student_id=$1 AND p.user_id=$2 AND sp.school_id=$3`,[studentId,parentUserId,schoolId]);
 if(!link)throw fail(403,'Student is not linked to this parent');
 const {rows:[s]}=await pool.query(`SELECT s.id,s.admission_number,u.name,u.email,c.name AS class_name,sec.name AS section_name,y.name AS academic_year_name FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN LATERAL(SELECT e.class_id,e.section_id,e.academic_year_id FROM enrollments e WHERE e.student_id=s.id AND e.school_id=s.school_id AND e.status='active' ORDER BY e.enrolled_on DESC LIMIT 1) e ON true LEFT JOIN classes c ON c.id=e.class_id LEFT JOIN sections sec ON sec.id=e.section_id LEFT JOIN academic_years y ON y.id=e.academic_year_id WHERE s.id=$1 AND s.school_id=$2`,[studentId,schoolId]);
 const invoices=await pool.query(`SELECT i.id,i.invoice_number,i.title,i.amount_minor,i.currency,i.issued_on::text AS issued_on,i.due_on::text AS due_on,coalesce((SELECT sum(amount_minor) FROM fee_payments p WHERE p.invoice_id=i.id AND p.reversed_at IS NULL),0)::bigint AS paid_minor FROM fee_invoices i WHERE i.student_id=$1 AND i.school_id=$2 AND i.voided_at IS NULL ORDER BY i.issued_on DESC LIMIT 20`,[studentId,schoolId]);
 const attendance=await pool.query(`SELECT to_char(attendance_date,'YYYY-MM-DD') AS date,status FROM attendance_entries ae WHERE ae.student_id=$1 AND EXISTS(SELECT 1 FROM attendance_registers ar WHERE ar.id=ae.register_id AND ar.school_id=$2) AND ae.status<>'void' AND ae.attendance_date>=CURRENT_DATE-30 ORDER BY ae.attendance_date DESC`,[studentId,schoolId]);
 const homework=await pool.query(`SELECT h.id,h.title,h.due_on::text AS due_on,h.archived_at IS NOT NULL AS archived FROM homework h WHERE h.school_id=$1 AND h.section_id IN (SELECT e.section_id FROM enrollments e WHERE e.student_id=$2 AND e.status='active') ORDER BY h.due_on DESC LIMIT 20`,[schoolId,studentId]);
 return {student:s,invoices:invoices.rows,attendance:attendance.rows,homework:homework.rows};
}
