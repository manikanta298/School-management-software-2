import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
// 4.1 Leave management + teacher-parent messaging.
export async function listLeave(schoolId,query){
 const values=[schoolId],filters=['l.school_id=$1'];
 if(query.status){values.push(query.status);filters.push(`l.status=$${values.length}`);}
 if(query.person_type){values.push(query.person_type);filters.push(`l.person_type=$${values.length}`);}
 if(query.person_id){values.push(query.person_id);filters.push(`l.person_id=$${values.length}`);}
 values.push(query.limit,query.offset);
 return (await pool.query(`SELECT l.id,l.person_type,l.person_id,l.from_date::text AS from_date,l.to_date::text AS to_date,l.reason,l.status,l.requested_at::text AS requested_at,l.reviewed_at::text AS reviewed_at,l.review_note,u.name AS requested_by_name FROM leave_requests l JOIN users u ON u.id=l.requested_by WHERE ${filters.join(' AND ')} ORDER BY l.requested_at DESC,l.id LIMIT $${values.length-1} OFFSET $${values.length}`,values)).rows;
}
export async function createLeave(schoolId,userId,data){
 // Verify person exists in this school.
 if(data.person_type==='student'){const {rows:[r]}=await pool.query('SELECT id FROM students WHERE id=$1 AND school_id=$2',[data.person_id,schoolId]);if(!r)throw fail(404,'Student not found in this school');}
 else{const {rows:[r]}=await pool.query('SELECT id FROM staff_members WHERE id=$1 AND school_id=$2',[data.person_id,schoolId]);if(!r)throw fail(404,'Staff not found in this school');}
 const {rows:[row]}=await pool.query('INSERT INTO leave_requests(school_id,person_type,person_id,from_date,to_date,reason,requested_by,academic_year_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,person_type,person_id,from_date::text AS from_date,to_date::text AS to_date,reason,status,requested_at::text AS requested_at',[schoolId,data.person_type,data.person_id,data.from_date,data.to_date,data.reason,userId,data.academic_year_id]);
 return row;
}
export async function reviewLeave(schoolId,id,userId,decision,note){
 const {rows:[row]}=await pool.query("UPDATE leave_requests SET status=$3,reviewed_by=$4,reviewed_at=now(),review_note=$5 WHERE id=$1 AND school_id=$2 AND status='pending' RETURNING id,status,reviewed_at::text AS reviewed_at,review_note",[id,schoolId,decision,userId,note]);
 if(!row)throw fail(409,'Leave request not found or already reviewed');
 return row;
}
export async function listBalances(schoolId,staffId){
 const values=[schoolId],filters=['b.school_id=$1'];
 if(staffId){values.push(staffId);filters.push(`b.staff_id=$${values.length}`);}
 return (await pool.query(`SELECT b.id,b.staff_id,b.academic_year_id,b.total_days,b.used_days,s.name AS staff_name,y.name AS academic_year_name FROM leave_balances b JOIN staff_members s ON s.id=b.staff_id JOIN academic_years y ON y.id=b.academic_year_id WHERE ${filters.join(' AND ')} ORDER BY s.name,y.name`,values)).rows;
}
export async function saveBalance(schoolId,id,data){
 if(id){const {rows:[row]}=await pool.query('UPDATE leave_balances SET total_days=$3 WHERE id=$1 AND school_id=$2 RETURNING id,total_days,used_days',[id,schoolId,data.total_days]);return row;}
 const {rows:[row]}=await pool.query('INSERT INTO leave_balances(school_id,staff_id,academic_year_id,total_days,used_days) VALUES($1,$2,$3,$4,0) RETURNING id,total_days,used_days',[schoolId,data.staff_id,data.academic_year_id,data.total_days]);
 return row;
}
// Messaging
export async function listThreads(user,schoolId){
 const role=user.role;
 const values=[schoolId],filters=['t.school_id=$1'];
 if(role==='teacher'){values.push(user.id);filters.push(`EXISTS(SELECT 1 FROM teachers tc WHERE tc.id=t.teacher_id AND tc.user_id=$${values.length} AND tc.school_id=t.school_id)`);}
 else if(role==='parent'){values.push(user.id);filters.push(`EXISTS(SELECT 1 FROM parents p WHERE p.id=t.parent_id AND p.user_id=$${values.length} AND p.school_id=t.school_id)`);}
 return (await pool.query(`SELECT t.id,t.teacher_id,t.parent_id,t.student_id,u.name AS teacher_name,pu.name AS parent_name,su.name AS student_name,t.created_at::text AS created_at,(SELECT count(*)::int FROM message_messages m WHERE m.thread_id=t.id AND m.read_at IS NULL AND m.sent_by<>$${values.length}) AS unread FROM message_threads t JOIN teachers tc ON tc.id=t.teacher_id JOIN users u ON u.id=tc.user_id JOIN parents p ON p.id=t.parent_id JOIN users pu ON pu.id=p.user_id JOIN students s ON s.id=t.student_id JOIN users su ON su.id=s.user_id WHERE ${filters.join(' AND ')} ORDER BY t.created_at DESC`,values)).rows;
}
export async function createThread(schoolId,userId,data){
 // Verify teacher, parent, student all in this school AND the parent is linked to the student.
 const {rows:[triplet]}=await pool.query(`SELECT t.id FROM teachers t JOIN parents p ON p.school_id=t.school_id JOIN student_parents sp ON sp.parent_id=p.id AND sp.student_id=$3 JOIN students s ON s.id=sp.student_id AND s.school_id=t.school_id WHERE t.id=$1 AND p.id=$2 AND s.id=$3 AND t.school_id=$4`,[data.teacher_id,data.parent_id,data.student_id,schoolId]);
 if(!triplet||!triplet.id)throw fail(403,'Parent is not linked to this student in this school');
 // Idempotent: if a thread already exists for this triplet, return it.
 const {rows:[existing]}=await pool.query('SELECT id,school_id,teacher_id,parent_id,student_id,created_at FROM message_threads WHERE school_id=$1 AND teacher_id=$2 AND parent_id=$3 AND student_id=$4',[schoolId,data.teacher_id,data.parent_id,data.student_id]);
 if(existing)return existing;
 const {rows:[row]}=await pool.query('INSERT INTO message_threads(school_id,teacher_id,parent_id,student_id) VALUES($1,$2,$3,$4) RETURNING id,school_id,teacher_id,parent_id,student_id,created_at',[schoolId,data.teacher_id,data.parent_id,data.student_id]);
 return row;
}
export async function listMessages(schoolId,threadId,user){
 const {rows:[t]}=await pool.query('SELECT teacher_id,parent_id FROM message_threads WHERE id=$1 AND school_id=$2',[threadId,schoolId]);
 if(!t)throw fail(404,'Thread not found');
 // Verify caller is a participant.
 if(user.role==='teacher'){const {rows:[r]}=await pool.query('SELECT 1 FROM teachers tc WHERE tc.id=$1 AND tc.user_id=$2 AND tc.school_id=$3',[t.teacher_id,user.id,schoolId]);if(!r)throw fail(403,'Not a participant');}
 else if(user.role==='parent'){const {rows:[r]}=await pool.query('SELECT 1 FROM parents p WHERE p.id=$1 AND p.user_id=$2 AND p.school_id=$3',[t.parent_id,user.id,schoolId]);if(!r)throw fail(403,'Not a participant');}
 else if(user.role!=='admin'&&user.role!=='principal')throw fail(403,'Not allowed');
 return (await pool.query(`SELECT m.id,m.body,m.sent_by,u.name AS sent_by_name,m.sent_at::text AS sent_at,m.read_at::text AS read_at FROM message_messages m JOIN users u ON u.id=m.sent_by WHERE m.thread_id=$1 AND m.school_id=$2 ORDER BY m.sent_at,m.id`,[threadId,schoolId])).rows;
}
export async function sendMessage(schoolId,threadId,userId,user,body){
 const {rows:[t]}=await pool.query('SELECT teacher_id,parent_id FROM message_threads WHERE id=$1 AND school_id=$2',[threadId,schoolId]);
 if(!t)throw fail(404,'Thread not found');
 let allowed=false;
 if(user.role==='teacher'){const {rows}=await pool.query('SELECT 1 FROM teachers tc WHERE tc.id=$1 AND tc.user_id=$2 AND tc.school_id=$3',[t.teacher_id,userId,schoolId]);if(rows.length)allowed=true;}
 else if(user.role==='parent'){const {rows}=await pool.query('SELECT 1 FROM parents p WHERE p.id=$1 AND p.user_id=$2 AND p.school_id=$3',[t.parent_id,userId,schoolId]);if(rows.length)allowed=true;}
 else if(user.role==='admin'||user.role==='principal')allowed=true;
 if(!allowed)throw fail(403,'Not a participant');
 const {rows:[row]}=await pool.query('INSERT INTO message_messages(school_id,thread_id,body,sent_by) VALUES($1,$2,$3,$4) RETURNING id,body,sent_at::text AS sent_at',[schoolId,threadId,body,userId]);
 await pool.query('UPDATE message_messages SET read_at=now() WHERE thread_id=$1 AND school_id=$2 AND sent_by<>$3 AND read_at IS NULL',[threadId,schoolId,userId]);
 return row;
}
