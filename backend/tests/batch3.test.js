import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import request from 'supertest';
process.env.NODE_ENV='test';process.env.JWT_SECRET='batch3-test-secret'.repeat(4);process.env.DATABASE_URL='postgres://test:test@localhost/test';process.env.FRONTEND_ORIGIN='http://localhost:5173';
const {pool}=await import('../src/config/db.js');const db=new PGlite();await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
const query=async(text,params)=>{const r=await db.query(text,params);return {...r,rowCount:r.rows.length||r.affectedRows||0};};pool.query=query;pool.connect=async()=>({query,release(){}});
const schoolA=(await query("SELECT id FROM schools WHERE slug='existing-school'")).rows[0].id;
const schoolB=(await query("INSERT INTO schools(name,slug) VALUES('School B','school-b-batch3') RETURNING id")).rows[0].id;
for(const {table_name} of (await query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='school_id' AND table_name NOT IN ('school_memberships','school_profiles','fee_concessions','fee_instalments','fee_penalties','fee_refunds','report_card_remarks','certificates_issued','class_subject_combinations','staff_attendance','staff_documents','homework_attachments','homework_submissions','attendance_corrections','exam_types','exam_student_remarks','timetable_periods','notification_preferences')")).rows)await query(`ALTER TABLE ${table_name} ALTER COLUMN school_id SET DEFAULT '${schoolA}'`);
const {app}=await import('../src/app.js');const {hashPassword}=await import('../src/services/auth.js');
const hash=await hashPassword('Batch3Pass!123'),accounts={},tokens={},ids={};
const insert=async(sql,p)=>(await query(sql,p)).rows[0].id;
const mk=async(email,role,school=schoolA)=>{const id=await insert('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',[email,email,hash,role]);await query("INSERT INTO school_memberships(school_id,user_id,role,status,is_default) VALUES($1,$2,$3,'active',true)",[school,id,role]);return id;};
for(const [key,role] of [['admin','admin'],['principal','principal'],['accountant','accountant'],['teacher','teacher'],['s1','student'],['parent','parent']]){accounts[key]=await mk(`${key}@example.com`,role);}
accounts.adminb=await mk('adminb@example.com','admin',schoolB);
for(const key of ['admin','principal','accountant','teacher','s1','parent','adminb']){const r=await request(app).post('/api/auth/login').send({email:`${key}@example.com`,password:'Batch3Pass!123'});assert.equal(r.status,200,key);tokens[key]=r.body.accessToken;}
ids.year=await insert("INSERT INTO academic_years(name,start_date,end_date,is_current) VALUES('2025-26','2025-06-01','2026-05-31',true) RETURNING id");
ids.class=await insert('INSERT INTO classes(name,academic_year_id) VALUES($1,$2) RETURNING id',['Grade 5',ids.year]);
ids.section=await insert('INSERT INTO sections(name,class_id,capacity) VALUES($1,$2,40) RETURNING id',['A',ids.class]);
ids.subject=await insert('INSERT INTO subjects(name,code) VALUES($1,$2) RETURNING id',['Math','MAT']);
ids.s1=await insert('INSERT INTO students(user_id,admission_number,admission_date) VALUES($1,$2,$3) RETURNING id',[accounts.s1,'ADM-S1','2025-01-01']);
ids.s1enr=await insert('INSERT INTO enrollments(student_id,academic_year_id,class_id,section_id,enrolled_on) VALUES($1,$2,$3,$4,$5) RETURNING id',[ids.s1,ids.year,ids.class,ids.section,'2025-06-01']);
ids.teacher=await insert("INSERT INTO teachers(user_id,employee_number,joining_date) VALUES($1,$2,$3) RETURNING id",[accounts.teacher,'EMP-T1','2025-01-01']);
ids.staff=await insert("INSERT INTO staff_members(school_id,employee_number,name,staff_type,joining_date) VALUES($1,$2,'Jane Doe','administrative','2025-01-01') RETURNING id",[schoolA,'EMP-S1']);
const as=(who)=>({get:p=>request(app).get(p).set('Authorization',`Bearer ${tokens[who]}`),post:(p,b={})=>request(app).post(p).set('Authorization',`Bearer ${tokens[who]}`).send(b),put:(p,b={})=>request(app).put(p).set('Authorization',`Bearer ${tokens[who]}`).send(b)});
after(async()=>{await db.close();await pool.end();});

test('3.1 staff attendance, documents, teacher workload',async()=>{
 let r=await as('admin').put('/api/staff/attendance',{staff_id:ids.staff,attendance_date:'2025-09-01',status:'present'});
 assert.equal(r.status,200,r.body.message);
 r=await as('admin').get('/api/staff/attendance?from=2025-09-01&to=2025-09-01');
 assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].status,'present');
 r=await as('adminb').get('/api/staff/attendance');assert.equal(r.body.items.length,0);
 // document upload
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
 r=await as('admin').post(`/api/staff/${ids.staff}/documents`,{name:'contract.pdf',mime:'image/png',data:png});
 assert.equal(r.status,201,r.body.message);assert.ok(r.body.item.size>0);
 r=await as('admin').get(`/api/staff/${ids.staff}/documents`);assert.equal(r.body.items.length,1);
 // cross-school: adminB cannot see school A staff
 r=await as('adminb').get(`/api/staff/${ids.staff}/documents`);assert.equal(r.status,404);
 // workload
 r=await as('admin').get(`/api/teachers/${ids.teacher}/workload`);assert.equal(r.status,200);assert.equal(r.body.item.teacher.id,ids.teacher);
 r=await as('adminb').get(`/api/teachers/${ids.teacher}/workload`);assert.equal(r.status,404);
});

test('3.2 attendance alerts, monthly report, corrections queue',async()=>{
 // create attendance register and entries
 const reg=await insert("INSERT INTO attendance_registers(section_id,class_id,academic_year_id,attendance_date,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",[ids.section,ids.class,ids.year,'2025-09-01',accounts.admin]);
 await query("INSERT INTO attendance_entries(register_id,attendance_date,student_id,enrollment_id,status,updated_by) VALUES($1,$2,$3,$4,$5,$6)",[reg,'2025-09-01',ids.s1,ids.s1enr,'absent',accounts.admin]);
 let r=await as('admin').get('/api/attendance/alerts?threshold=50&from=2025-09-01&to=2025-09-01');
 assert.equal(r.status,200);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].student_id,ids.s1);
 r=await as('admin').get(`/api/attendance/reports/monthly?section_id=${ids.section}&month=2025-09`);
 assert.equal(r.status,200);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].absent,1);
 // corrections queue
 r=await as('teacher').post('/api/attendance/corrections',{student_id:ids.s1,attendance_date:'2025-09-01',requested_status:'present',reason:'Marked in error'});
 assert.equal(r.status,201,r.body.message);ids.correction=r.body.item.id;
 r=await as('admin').get('/api/attendance/corrections?status=pending');assert.equal(r.body.items.length,1);
 r=await as('admin').post(`/api/attendance/corrections/${ids.correction}/approve`,{decision:'approved',note:'Verified'});
 assert.equal(r.status,200,r.body.message);assert.equal(r.body.item.status,'approved');
 r=await as('accountant').post('/api/attendance/corrections',{student_id:ids.s1,attendance_date:'2025-09-02',requested_status:'present',reason:'x'});assert.equal(r.status,403);
 r=await as('adminb').get('/api/attendance/corrections');assert.equal(r.body.items.length,0);
});

test('3.3 homework attachments, submissions, feedback',async()=>{
 // Create the homework as teacher via API so the teacher can edit it; first add a teacher_assignment.
 await query("INSERT INTO teacher_assignments(school_id,teacher_id,class_id,subject_id,academic_year_id,kind) VALUES($1,$2,$3,$4,$5,'subject_teacher')",[schoolA,ids.teacher,ids.class,ids.subject,ids.year]);
 let r=await as('teacher').post('/api/homework',{section_id:ids.section,subject_id:ids.subject,title:'HW1',details:'Do exercises',due_on:'2027-09-10'});
 assert.equal(r.status,201,r.body.message);ids.homework=r.body.item.id;
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
 r=await as('teacher').post(`/api/homework/${ids.homework}/attachments`,{name:'worksheet.png',mime:'image/png',data:png});
 assert.equal(r.status,201,r.body.message);
 r=await as('admin').get(`/api/homework/${ids.homework}/attachments`);assert.equal(r.body.items.length,1);
 r=await as('s1').post(`/api/homework/${ids.homework}/submissions`,{name:'myanswer.png',mime:'image/png',data:png,note:'Done'});
 assert.equal(r.status,201,r.body.message);
 r=await as('teacher').get(`/api/homework/${ids.homework}/submissions`);assert.equal(r.body.items.length,1);
 r=await as('teacher').put(`/api/homework/${ids.homework}/submissions/${ids.s1}/feedback`,{feedback:'Good work'});
 assert.equal(r.status,200,r.body.message);assert.equal(r.body.item.feedback,'Good work');
 r=await as('adminb').get(`/api/homework/${ids.homework}/attachments`);assert.equal(r.status,404);
});

test('3.4 exam types, ranks, principal remarks',async()=>{
 let r=await as('admin').post('/api/exams/types',{name:'Unit Test',code:'UT'});
 assert.equal(r.status,201,r.body.message);ids.type=r.body.item.id;
 r=await as('admin').get('/api/exams/types');assert.equal(r.body.items.length,1);
 // adminB can create types in their own school, but they do not appear in school A's list.
 r=await as('adminb').post('/api/exams/types',{name:'B Type',code:'BT'});assert.equal(r.status,201,r.body.message);
 r=await as('admin').get('/api/exams/types');assert.equal(r.body.items.length,1);
 // ranks + remarks need a published exam with marks
 const scaleId='00000000-0000-4000-8000-000000000007';
 ids.exam=await insert("INSERT INTO exams(class_id,academic_year_id,grading_scale_id,name,start_date,end_date,status,created_by,updated_by) VALUES($1,$2,$3,'Mid','2025-09-01','2025-09-02','draft',$4,$4) RETURNING id",[ids.class,ids.year,scaleId,accounts.admin]);
 ids.paper=await insert("INSERT INTO exam_papers(exam_id,subject_id,held_on,max_marks,pass_marks) VALUES($1,$2,'2025-09-02',100,35) RETURNING id",[ids.exam,ids.subject]);
 await query("INSERT INTO exam_candidates(exam_id,student_id,enrollment_id,section_id,class_id) VALUES($1,$2,$3,$4,$5)",[ids.exam,ids.s1,ids.s1enr,ids.section,ids.class]);
 await query("INSERT INTO exam_marks(exam_id,paper_id,student_id,outcome,score,updated_by) VALUES($1,$2,$3,'scored',88,$4)",[ids.exam,ids.paper,ids.s1,accounts.admin]);
 await query("UPDATE exams SET status='published' WHERE id=$1",[ids.exam]);
 r=await as('admin').get(`/api/exams/${ids.exam}/ranks`);assert.equal(r.status,200);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].rank,1);
 r=await as('principal').put(`/api/exams/${ids.exam}/students/${ids.s1}/remarks`,{remark:'Solid improvement'});
 assert.equal(r.status,200,r.body.message);
 r=await as('adminb').get(`/api/exams/${ids.exam}/ranks`);assert.equal(r.status,404);
});

test('3.5 timetable periods, weekly view, teacher-wise',async()=>{
 let r=await as('admin').put('/api/timetable/periods',{periods:[{day_of_week:1,period_index:1,start_time:'09:00',end_time:'09:45',is_break:false,label:'P1'},{day_of_week:1,period_index:2,start_time:'09:45',end_time:'10:30',is_break:false,label:'P2'}]});
 assert.equal(r.status,200,r.body.message);assert.equal(r.body.items.length,2);
 r=await as('admin').get('/api/timetable/periods');assert.equal(r.body.items.length,2);
 r=await as('adminb').get('/api/timetable/periods');assert.equal(r.body.items.length,0);
 r=await as('admin').get(`/api/timetable/week?section_id=${ids.section}`);assert.equal(r.status,200);
 r=await as('admin').get(`/api/timetable/teachers/${ids.teacher}`);assert.equal(r.status,200);
 r=await as('adminb').get(`/api/timetable/teachers/${ids.teacher}`);assert.equal(r.status,404);
});

test('3.6 reports endpoint: csv, xlsx, pdf, cross-school',async()=>{
 // Seed a fee invoice + payment for fees-collection report
 ids.fee=await insert("INSERT INTO fee_structures(class_id,academic_year_id,name,amount_minor,currency,active) VALUES($1,$2,'Tuition',10000,'INR',true) RETURNING id",[ids.class,ids.year]);
 ids.invoice=await insert("INSERT INTO fee_invoices(student_id,fee_structure_id,enrollment_id,class_id,academic_year_id,title,amount_minor,currency,issued_on,due_on,created_by) VALUES($1,$2,$3,$4,$5,'Tuition',10000,'INR','2025-06-01','2025-06-30',$6) RETURNING id",[ids.s1,ids.fee,ids.s1enr,ids.class,ids.year,accounts.admin]);
 await query("INSERT INTO fee_payments(school_id,invoice_id,amount_minor,paid_on,method,reference,idempotency_key,recorded_by) VALUES($1,$2,5000,'2025-06-05','cash',null,$3,$4)",[schoolA,ids.invoice,randomUUID(),accounts.admin]);
 let r=await as('admin').get('/api/reports/students?format=csv');
 assert.equal(r.status,200);assert.ok(r.headers['content-type'].includes('text/csv'));assert.ok(r.text.includes('ADM-S1'));
 r=await as('admin').get('/api/reports/fees-collection?format=xlsx');
 assert.equal(r.status,200);assert.equal(r.headers['content-type'],'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 r=await as('admin').get('/api/reports/defaulters?format=pdf');
 assert.equal(r.status,200);assert.equal(r.headers['content-type'],'application/pdf');
 r=await as('adminb').get('/api/reports/students?format=csv');assert.equal(r.status,200);assert.ok(!r.text.includes('ADM-S1'));
 r=await as('admin').get('/api/reports/unknown?format=csv');assert.equal(r.status,404);
 r=await as('s1').get('/api/reports/students?format=csv');assert.equal(r.status,403);
});

test('3.7 settings: notification preferences per user',async()=>{
 let r=await as('admin').put('/api/settings/notifications',{preferences:[{channel:'in_app',enabled:true,digest:'daily'},{channel:'email',enabled:false,digest:'instant'}]});
 assert.equal(r.status,200,r.body.message);assert.equal(r.body.items.length,2);
 r=await as('admin').get('/api/settings/notifications');assert.equal(r.body.items.length,2);
 r=await as('principal').get('/api/settings/notifications');assert.equal(r.body.items.length,0);
 // accountant is blocked at module access (403); student not allowed either.
 r=await as('s1').put('/api/settings/notifications',{preferences:[]});
 assert.ok(r.status===400||r.status===403,'expected 400 or 403 for student, got '+r.status);
});
