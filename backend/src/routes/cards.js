import { Router } from 'express';
import { authenticate,authorize } from '../middleware/auth.js';
import { moduleAccess } from '../middleware/permissions.js';
import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
import * as settings from '../services/settings.js';
export const cardsRouter=Router();
cardsRouter.use(authenticate,(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
const idParam=(req,res,next,value)=>{if(!/^[0-9a-f-]{36}$/.test(value))return res.status(400).json({message:'Invalid record ID'});next();};
cardsRouter.param('studentId',idParam);
cardsRouter.param('teacherId',idParam);
cardsRouter.param('examId',idParam);
async function studentCard(schoolId,studentId){
 const {rows:[s]}=await pool.query(`SELECT s.id,s.admission_number,u.name,u.email,c.name AS class_name,sec.name AS section_name,y.name AS academic_year_name,s.blood_group,s.gender FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN LATERAL(SELECT e.class_id,e.section_id,e.academic_year_id FROM enrollments e WHERE e.student_id=s.id AND e.school_id=s.school_id AND e.status='active' ORDER BY e.enrolled_on DESC LIMIT 1) e ON true LEFT JOIN classes c ON c.id=e.class_id LEFT JOIN sections sec ON sec.id=e.section_id LEFT JOIN academic_years y ON y.id=e.academic_year_id WHERE s.id=$1 AND s.school_id=$2`,[studentId,schoolId]);
 if(!s)throw fail(404,'Student not found in this school');
 const profile=await settings.publicProfile(schoolId);
 return {...s,profile};
}
async function teacherCard(schoolId,teacherId){
 const {rows:[t]}=await pool.query(`SELECT t.id,u.name,u.email,t.employee_number,t.joining_date::text AS joining_date,t.phone,t.qualification,t.employment_status FROM teachers t JOIN users u ON u.id=t.user_id WHERE t.id=$1 AND t.school_id=$2`,[teacherId,schoolId]);
 if(!t)throw fail(404,'Teacher not found in this school');
 const profile=await settings.publicProfile(schoolId);
 return {...t,profile};
}
async function hallTickets(schoolId,examId,sectionId){
 const {rows:[ex]}=await pool.query('SELECT id,name,status FROM exams WHERE id=$1 AND school_id=$2',[examId,schoolId]);
 if(!ex)throw fail(404,'Exam not found in this school');
 const values=[examId,schoolId],filters=['c.exam_id=$1','c.school_id=$2'];
 if(sectionId){values.push(sectionId);filters.push(`EXISTS(SELECT 1 FROM enrollments e WHERE e.student_id=c.student_id AND e.section_id=$${values.length} AND e.status='active')`);}
 const {rows}=await pool.query(`SELECT c.student_id,s.admission_number,u.name,s.gender,sec.name AS section_name,c.class_id FROM exam_candidates c JOIN students s ON s.id=c.student_id JOIN users u ON u.id=s.user_id LEFT JOIN LATERAL(SELECT e.section_id FROM enrollments e WHERE e.student_id=s.id AND e.school_id=s.school_id AND e.status='active' ORDER BY e.enrolled_on DESC LIMIT 1) e ON true LEFT JOIN sections sec ON sec.id=e.section_id WHERE ${filters.join(' AND ')} ORDER BY u.name`,values);
 const profile=await settings.publicProfile(schoolId);
 return {exam:ex,candidates:rows,profile};
}
// ID-card endpoints are data-only; the UI renders the printable card.
cardsRouter.get('/students/:studentId/id-card',moduleAccess('students',{convert:false}),authorize('admin','teacher','student','parent'),async(req,res,next)=>{
 try{
  if(req.user.role==='student'){const {rows:[own]}=await pool.query('SELECT id FROM students WHERE user_id=$1 AND school_id=$2',[req.user.id,req.schoolId]);if(own?.id!==req.params.studentId)throw fail(403,'Not your card');}
  else if(req.user.role==='parent'){const {rows:[link]}=await pool.query('SELECT 1 FROM student_parents sp JOIN parents p ON p.id=sp.parent_id AND p.school_id=sp.school_id WHERE sp.student_id=$1 AND p.user_id=$2 AND sp.school_id=$3',[req.params.studentId,req.user.id,req.schoolId]);if(!link)throw fail(403,'Not your child');}
  res.json({item:await studentCard(req.schoolId,req.params.studentId)});
 }catch(e){next(e);}
});
cardsRouter.get('/teachers/:teacherId/id-card',moduleAccess('teachers',{convert:false}),authorize('admin','teacher'),async(req,res,next)=>{try{res.json({item:await teacherCard(req.schoolId,req.params.teacherId)});}catch(e){next(e);}});
cardsRouter.get('/exams/:examId/hall-tickets',moduleAccess('exams',{convert:false}),authorize('admin','teacher'),async(req,res,next)=>{try{const sid=req.query.section_id&&/^[0-9a-f-]{36}$/.test(req.query.section_id)?req.query.section_id:null;res.json(await hallTickets(req.schoolId,req.params.examId,sid));}catch(e){next(e);}});
