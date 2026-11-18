import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import request from 'supertest';
import speakeasy from 'speakeasy';
process.env.NODE_ENV='test';process.env.JWT_SECRET='batch4-test-secret'.repeat(4);process.env.DATABASE_URL='postgres://test:test@localhost/test';process.env.FRONTEND_ORIGIN='http://localhost:5173';
const {pool}=await import('../src/config/db.js');const db=new PGlite();await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
const query=async(text,params)=>{const r=await db.query(text,params);return {...r,rowCount:r.rows.length||r.affectedRows||0};};pool.query=query;pool.connect=async()=>({query,release(){}});
const schoolA=(await query("SELECT id FROM schools WHERE slug='existing-school'")).rows[0].id;
const schoolB=(await query("INSERT INTO schools(name,slug) VALUES('School B','school-b-batch4') RETURNING id")).rows[0].id;
for(const {table_name} of (await query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='school_id' AND table_name NOT IN ('school_memberships','school_profiles','fee_concessions','fee_instalments','fee_penalties','fee_refunds','report_card_remarks','certificates_issued','class_subject_combinations','staff_attendance','staff_documents','homework_attachments','homework_submissions','attendance_corrections','exam_types','exam_student_remarks','timetable_periods','notification_preferences','leave_requests','leave_balances','message_threads','message_messages')")).rows)await query(`ALTER TABLE ${table_name} ALTER COLUMN school_id SET DEFAULT '${schoolA}'`);
const {app}=await import('../src/app.js');const {hashPassword}=await import('../src/services/auth.js');
const hash=await hashPassword('Batch4Pass!123'),accounts={},tokens={},ids={};
const insert=async(sql,p)=>(await query(sql,p)).rows[0].id;
const mk=async(email,role,school=schoolA)=>{const id=await insert('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',[email,email,hash,role]);await query("INSERT INTO school_memberships(school_id,user_id,role,status,is_default) VALUES($1,$2,$3,'active',true)",[school,id,role]);return id;};
for(const [key,role] of [['admin','admin'],['principal','principal'],['teacher','teacher'],['parent','parent']]){accounts[key]=await mk(`${key}@example.com`,role);}
accounts.adminb=await mk('adminb@example.com','admin',schoolB);
for(const key of ['admin','principal','teacher','parent','adminb']){const r=await request(app).post('/api/auth/login').send({email:`${key}@example.com`,password:'Batch4Pass!123'});assert.equal(r.status,200,key);tokens[key]=r.body.accessToken;}
ids.year=await insert("INSERT INTO academic_years(name,start_date,end_date,is_current) VALUES('2025-26','2025-06-01','2026-05-31',true) RETURNING id");
ids.class=await insert('INSERT INTO classes(name,academic_year_id) VALUES($1,$2) RETURNING id',['Grade 5',ids.year]);
ids.section=await insert('INSERT INTO sections(name,class_id,capacity) VALUES($1,$2,40) RETURNING id',['A',ids.class]);
// Create a student (with parent linkage) and a staff member for leave tests
const sUser=await insert("INSERT INTO users(name,email,password_hash,role) VALUES('Stu','s1@example.com',$1,'student') RETURNING id",[hash]);
ids.student=await insert("INSERT INTO students(user_id,admission_number,admission_date) VALUES($1,'ADM-S1','2025-01-01') RETURNING id",[sUser]);
ids.senr=await insert("INSERT INTO enrollments(student_id,academic_year_id,class_id,section_id,enrolled_on) VALUES($1,$2,$3,$4,$5) RETURNING id",[ids.student,ids.year,ids.class,ids.section,'2025-06-01']);
// accounts.parent is a parent user; create the parent row and link to student
ids.parent=await insert("INSERT INTO parents(user_id) VALUES($1) RETURNING id",[accounts.parent]);
await query("INSERT INTO student_parents(student_id,parent_id,relationship) VALUES($1,$2,'guardian')",[ids.student,ids.parent]);
// teacher row + teacher_assignment so the teacher can teach this class
ids.teacher=await insert("INSERT INTO teachers(user_id,employee_number,joining_date) VALUES($1,$2,$3) RETURNING id",[accounts.teacher,'EMP-T1','2025-01-01']);
ids.subject=await insert('INSERT INTO subjects(name,code) VALUES($1,$2) RETURNING id',['Math','MAT']);
await query("INSERT INTO teacher_assignments(school_id,teacher_id,class_id,subject_id,academic_year_id,kind) VALUES($1,$2,$3,$4,$5,'subject_teacher')",[schoolA,ids.teacher,ids.class,ids.subject,ids.year]);
// staff row for staff-leave
ids.staff=await insert("INSERT INTO staff_members(school_id,employee_number,name,staff_type,joining_date) VALUES($1,$2,'Jane Doe','administrative','2025-01-01') RETURNING id",[schoolA,'EMP-S1']);
const as=(who)=>({get:p=>request(app).get(p).set('Authorization',`Bearer ${tokens[who]}`),post:(p,b={})=>request(app).post(p).set('Authorization',`Bearer ${tokens[who]}`).send(b),put:(p,b={})=>request(app).put(p).set('Authorization',`Bearer ${tokens[who]}`).send(b)});
after(async()=>{await db.close();await pool.end();});

test('4.1 leave management: students + staff, approvals, balances, cross-school',async()=>{
 // Parent applies for student leave on behalf of the child.
 let r=await as('parent').post('/api/leave',{person_type:'student',person_id:ids.student,from_date:'2025-10-01',to_date:'2025-10-02',reason:'Family event',academic_year_id:ids.year});
 assert.equal(r.status,201,r.body.message);ids.studentLeave=r.body.item.id;
 r=await as('admin').get('/api/leave?status=pending');assert.equal(r.body.items.length,1);
 r=await as('admin').post(`/api/leave/${ids.studentLeave}/approve`,{note:'Approved'});
 assert.equal(r.status,200,r.body.message);assert.equal(r.body.item.status,'approved');
 // Staff leave
 r=await as('admin').post('/api/leave',{person_type:'staff',person_id:ids.staff,from_date:'2025-11-01',to_date:'2025-11-03',reason:'Medical',academic_year_id:ids.year});
 assert.equal(r.status,201,r.body.message);ids.staffLeave=r.body.item.id;
 r=await as('admin').post(`/api/leave/${ids.staffLeave}/reject`,{note:'Insufficient cover'});assert.equal(r.status,200);
 // Leave balance
 r=await as('admin').post('/api/leave/balances',{staff_id:ids.staff,academic_year_id:ids.year,total_days:12});
 assert.equal(r.status,201,r.body.message);
 r=await as('admin').get('/api/leave/balances');assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].total_days,12);
 // Cross-school: adminB cannot see school A's leave requests.
 r=await as('adminb').get('/api/leave');assert.equal(r.body.items.length,0);
 r=await as('adminb').post('/api/leave',{person_type:'staff',person_id:ids.staff,from_date:'2025-12-01',to_date:'2025-12-02',reason:'cross-school attempt',academic_year_id:ids.year});assert.equal(r.status,404);
});

test('4.1 messaging: teacher-parent threads scoped to linked children',async()=>{
 // Parent starts a thread with the teacher about their linked child.
 let r=await as('parent').post('/api/messages/threads',{teacher_id:ids.teacher,parent_id:ids.parent,student_id:ids.student});
 assert.equal(r.status,201,r.body.message);ids.thread=r.body.item.id;
 r=await as('parent').post(`/api/messages/threads/${ids.thread}`,{thread_id:ids.thread,body:'Hello, how is my child doing?'});
 assert.equal(r.status,201,r.body.message);
 r=await as('teacher').get(`/api/messages/threads/${ids.thread}`);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].body,'Hello, how is my child doing?');
 r=await as('teacher').post(`/api/messages/threads/${ids.thread}`,{thread_id:ids.thread,body:'She is doing well.'});assert.equal(r.status,201);
 // A parent of an unlinked student cannot start a thread (rejected with 403).
 const otherStudent=await insert("INSERT INTO students(user_id,admission_number,admission_date) VALUES($1,'ADM-OTHER','2025-01-01') RETURNING id",[(await insert("INSERT INTO users(name,email,password_hash,role) VALUES('Other Stu','other@example.com',$1,'student') RETURNING id",[hash]))]);
 r=await as('parent').post('/api/messages/threads',{teacher_id:ids.teacher,parent_id:ids.parent,student_id:otherStudent});
 assert.equal(r.status,403);
 // Cross-school: adminB cannot list school A's threads.
 r=await as('adminb').get('/api/messages/threads');
 if(r.status!==200)console.error('adminB threads:',r.status,r.body);
 assert.equal(r.status,200);
 assert.equal(r.body.items.length,0);
});

test('4.3 MFA: admin and principal can enroll, verify, unenroll; teacher/parent blocked',async()=>{
 let r=await as('admin').get('/api/auth/mfa/status');assert.equal(r.status,200);assert.equal(r.body.enrolled,false);
 r=await as('admin').post('/api/auth/mfa/enroll');assert.equal(r.status,200,r.body.message);assert.ok(r.body.secret);assert.ok(r.body.qr_url);
 // Compute a current TOTP and verify.
 const token=speakeasy.totp({secret:r.body.secret,encoding:'base32'});
 r=await as('admin').post('/api/auth/mfa/verify',{token});assert.equal(r.status,200,r.body.message);assert.equal(r.body.verified,true);
 // Wrong token -> 400.
 r=await as('admin').post('/api/auth/mfa/verify',{token:'000000'});assert.equal(r.status,400);
 r=await as('admin').get('/api/auth/mfa/status');assert.equal(r.body.enrolled,true);
 r=await as('admin').post('/api/auth/mfa/unenroll');assert.equal(r.status,200);
 r=await as('admin').get('/api/auth/mfa/status');assert.equal(r.body.enrolled,false);
 // Principal can enroll too.
 r=await as('principal').post('/api/auth/mfa/enroll');assert.equal(r.status,200);
 // Teacher cannot enroll (MFA is admin+principal only).
 r=await as('teacher').post('/api/auth/mfa/enroll');assert.equal(r.status,403);
 r=await as('parent').post('/api/auth/mfa/enroll');assert.equal(r.status,403);
});
