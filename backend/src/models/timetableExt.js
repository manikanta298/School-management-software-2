import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
// 3.5 Timetable extensions: periods, weekly view, teacher-wise.
export async function periods(schoolId){
 return (await pool.query(`SELECT id,day_of_week,period_index,to_char(start_time,'HH24:MI') AS start_time,to_char(end_time,'HH24:MI') AS end_time,is_break,label FROM timetable_periods WHERE school_id=$1 ORDER BY day_of_week,period_index`,[schoolId])).rows;
}
export async function savePeriods(schoolId,items){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  await c.query('DELETE FROM timetable_periods WHERE school_id=$1',[schoolId]);
  for(const it of items){await c.query('INSERT INTO timetable_periods(school_id,day_of_week,period_index,start_time,end_time,is_break,label) VALUES($1,$2,$3,$4,$5,$6,$7)',[schoolId,it.day_of_week,it.period_index,it.start_time,it.end_time,it.is_break??false,it.label||null]);}
  await c.query('COMMIT');
  return periods(schoolId);
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function weekly(schoolId,sectionId){
 return (await pool.query(`SELECT ts.id,ts.weekday,ts.start_minute,ts.end_minute,ts.active,ts.effective_from::text AS effective_from,ts.effective_to::text AS effective_to,sub.name AS subject_name,u.name AS teacher_name,sec.name AS section_name,r.name AS room_name FROM timetable_slots ts LEFT JOIN subjects sub ON sub.id=ts.subject_id LEFT JOIN teachers t ON t.id=ts.teacher_id LEFT JOIN users u ON u.id=t.user_id LEFT JOIN sections sec ON sec.id=ts.section_id LEFT JOIN school_rooms r ON r.id=ts.room_id WHERE ts.school_id=$1 AND ts.section_id=$2 AND ts.active=true ORDER BY ts.weekday,ts.start_minute`,[schoolId,sectionId])).rows;
}
export async function teacherwise(schoolId,teacherId){
 const {rows:[t]}=await pool.query('SELECT id FROM teachers WHERE id=$1 AND school_id=$2',[teacherId,schoolId]);
 if(!t)throw fail(404,'Teacher not found in this school');
 return (await pool.query(`SELECT ts.id,ts.weekday,ts.start_minute,ts.end_minute,ts.active,ts.effective_from::text AS effective_from,ts.effective_to::text AS effective_to,sub.name AS subject_name,sec.name AS section_name,c.name AS class_name,r.name AS room_name FROM timetable_slots ts LEFT JOIN subjects sub ON sub.id=ts.subject_id LEFT JOIN sections sec ON sec.id=ts.section_id LEFT JOIN classes c ON c.id=sec.class_id LEFT JOIN school_rooms r ON r.id=ts.room_id WHERE ts.school_id=$1 AND ts.teacher_id=$2 AND ts.active=true ORDER BY ts.weekday,ts.start_minute`,[schoolId,teacherId])).rows;
}
