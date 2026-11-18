import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import request from 'supertest';
process.env.NODE_ENV='test';process.env.JWT_SECRET='batch2-test-secret'.repeat(4);process.env.DATABASE_URL='postgres://test:test@localhost/test';process.env.FRONTEND_ORIGIN='http://localhost:5173';
const {pool}=await import('../src/config/db.js');const db=new PGlite();await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
const query=async(text,params)=>{const r=await db.query(text,params);return {...r,rowCount:r.rows.length||r.affectedRows||0};};pool.query=query;pool.connect=async()=>({query,release(){}});
const schoolA=(await query("SELECT id FROM schools WHERE slug='existing-school'")).rows[0].id;
const schoolB=(await query("INSERT INTO schools(name,slug) VALUES('School B','school-b-batch2') RETURNING id")).rows[0].id;
for(const {table_name} of (await query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='school_id' AND table_name NOT IN ('school_memberships','school_profiles','fee_concessions','fee_instalments','fee_penalties','fee_refunds','report_card_remarks','certificates_issued','class_subject_combinations')")).rows)await query(`ALTER TABLE ${table_name} ALTER COLUMN school_id SET DEFAULT '${schoolA}'`);
const {app}=await import('../src/app.js');const {hashPassword}=await import('../src/services/auth.js');
const hash=await hashPassword('Batch2Pass!123'),accounts={},tokens={},ids={};
const insert=async(sql,params)=>(await query(sql,params)).rows[0].id;
const mk=async(email,role,school=schoolA)=>{const id=await insert('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',[email,email,hash,role]);await query("INSERT INTO school_memberships(school_id,user_id,role,status,is_default) VALUES($1,$2,$3,'active',true)",[school,id,role]);return id;};
for(const [key,role] of [['admin','admin'],['principal','principal'],['accountant','accountant'],['receptionist','receptionist'],['teacher','teacher'],['s1','student'],['s2','student'],['parent','parent']]){accounts[key]=await mk(`${key}@example.com`,role);}
// School B admin for cross-school checks
accounts.adminb=await mk('adminb@example.com','admin',schoolB);
for(const key of ['admin','principal','accountant','receptionist','teacher','s1','s2','parent','adminb']){const r=await request(app).post('/api/auth/login').send({email:`${key}@example.com`,password:'Batch2Pass!123'});assert.equal(r.status,200,key);tokens[key]=r.body.accessToken;}
// Common fixtures: academic year, class, section, fee structure, two students with enrollments.
ids.year=await insert("INSERT INTO academic_years(name,start_date,end_date,is_current) VALUES('2025-26','2025-06-01','2026-05-31',true) RETURNING id");
ids.class=await insert('INSERT INTO classes(name,academic_year_id) VALUES($1,$2) RETURNING id',['Grade 5',ids.year]);
ids.section=await insert('INSERT INTO sections(name,class_id,capacity) VALUES($1,$2,40) RETURNING id',['A',ids.class]);
ids.subject=await insert('INSERT INTO subjects(name,code) VALUES($1,$2) RETURNING id',['Math','MAT']);
for(const key of ['s1','s2']){ids[key]=await insert('INSERT INTO students(user_id,admission_number,admission_date) VALUES($1,$2,$3) RETURNING id',[accounts[key],`ADM-${key.toUpperCase()}`,'2025-01-01']);ids[key+'enr']=await insert('INSERT INTO enrollments(student_id,academic_year_id,class_id,section_id,enrolled_on) VALUES($1,$2,$3,$4,$5) RETURNING id',[ids[key],ids.year,ids.class,ids.section,'2025-06-01']);}
ids.parent=await insert('INSERT INTO parents(user_id) VALUES($1) RETURNING id',[accounts.parent]);await query("INSERT INTO student_parents(student_id,parent_id,relationship) VALUES($1,$2,'guardian')",[ids.s1,ids.parent]);
ids.fee=await insert("INSERT INTO fee_structures(class_id,academic_year_id,name,amount_minor,currency,active) VALUES($1,$2,'Tuition',10000,'INR',true) RETURNING id",[ids.class,ids.year]);
ids.invoice=await insert("INSERT INTO fee_invoices(student_id,fee_structure_id,enrollment_id,class_id,academic_year_id,title,amount_minor,currency,issued_on,due_on,created_by) VALUES($1,$2,$3,$4,$5,'Tuition',10000,'INR','2025-06-01','2025-06-30',$6) RETURNING id",[ids.s1,ids.fee,ids.s1enr,ids.class,ids.year,accounts.admin]);
const as=(who)=>({get:p=>request(app).get(p).set('Authorization',`Bearer ${tokens[who]}`),post:(p,b={})=>request(app).post(p).set('Authorization',`Bearer ${tokens[who]}`).send(b),put:(p,b={})=>request(app).put(p).set('Authorization',`Bearer ${tokens[who]}`).send(b)});
after(async()=>{await db.close();await pool.end();});

test('2.0 school profile: admin writes, principal reads, other schools cannot see',async()=>{
 let r=await as('admin').get('/api/settings/school');assert.equal(r.status,200);assert.equal(r.body.item,null);
 r=await as('admin').put('/api/settings/school',{display_name:'Greenwood High',address:'1 School Lane',email:'info@greenwood.example',principal_name:'Ms. Patel'});assert.equal(r.status,200,r.body.message);assert.equal(r.body.item.display_name,'Greenwood High');
 r=await as('principal').get('/api/settings/school');assert.equal(r.status,200);assert.equal(r.body.item.display_name,'Greenwood High');
 r=await as('accountant').put('/api/settings/school',{display_name:'Hacked'});assert.equal(r.status,403);
 r=await as('adminb').get('/api/settings/school');assert.equal(r.status,200);assert.equal(r.body.item,null);
 r=await as('admin').put('/api/settings/school/logo',{mime:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII='});assert.equal(r.status,200,r.body.message);assert.ok(r.body.item.logo_size>0);
 r=await as('admin').put('/api/settings/school/logo',{mime:'image/png',data:'A'.repeat(700000)});assert.equal(r.status,400);
 r=await as('admin').get('/api/settings/permissions');assert.equal(r.status,200);assert.deepEqual(r.body.permissions?.fees,['view','manage']);
});

test('2.1 fees carry-over: concessions, instalments, penalties, refunds and statements',async()=>{
 // Add a 2000 concession; outstanding becomes 8000.
 let r=await as('admin').post(`/api/fees/invoices/${ids.invoice}/concessions`,{amount_minor:2000,reason:'Sibling discount'});assert.equal(r.status,201,r.body.message);ids.concession=r.body.item.id;
 r=await as('admin').get(`/api/fees/invoices/${ids.invoice}/concessions`);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].amount_minor,2000);
 // Pay 5000 of the remaining 8000.
 const payKey=randomUUID();r=await as('admin').post(`/api/fees/invoices/${ids.invoice}/payments`,{amount_minor:5000,paid_on:'2025-06-05',method:'cash',reference:null,idempotency_key:payKey});assert.equal(r.status,200,r.body.message);ids.payment=r.body.payment_id;
 // Outstanding is now 3000. Concession of 3001 must be rejected.
 r=await as('admin').post(`/api/fees/invoices/${ids.invoice}/concessions`,{amount_minor:3001,reason:'Too much'});assert.equal(r.status,400);
 // Overpayment: 3001 outstanding, pay 3002 -> rejected
 r=await as('admin').post(`/api/fees/invoices/${ids.invoice}/payments`,{amount_minor:3002,paid_on:'2025-06-06',method:'cash',reference:null,idempotency_key:randomUUID()});assert.equal(r.status,400);
 // Penalty 500: outstanding becomes 3500
 r=await as('admin').post(`/api/fees/invoices/${ids.invoice}/penalties`,{rule:'manual',amount_minor:500,applied_on:'2025-06-07',reason:'Late fee'});assert.equal(r.status,201,r.body.message);
 r=await as('admin').get(`/api/fees/invoices/${ids.invoice}/penalties`);assert.equal(r.body.items.length,1);
 // Instalments replace
 r=await as('admin').put(`/api/fees/invoices/${ids.invoice}/instalments`,{instalments:[{due_on:'2025-07-01',amount_minor:2000,position:0},{due_on:'2025-08-01',amount_minor:1500,position:1}]});assert.equal(r.status,200,r.body.message);assert.equal(r.body.items.length,2);
 // Refund 1000 of the 5000 payment
 r=await as('admin').post(`/api/fees/invoices/${ids.invoice}/payments/${ids.payment}/refund`,{payment_id:ids.payment,amount_minor:1000,reason:'Overpayment correction'});assert.equal(r.status,201,r.body.message);ids.refund=r.body.item.id;assert.ok(r.body.item.refund_number>=1);
 // Refund exceeding payment amount -> 400
 r=await as('admin').post(`/api/fees/invoices/${ids.invoice}/payments/${ids.payment}/refund`,{payment_id:ids.payment,amount_minor:5000,reason:'Too much'});assert.equal(r.status,400);
 // Statement
 r=await as('parent').get(`/api/fees/students/${ids.s1}/statement`);assert.equal(r.status,200);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].concessions_minor,2000);assert.equal(r.body.items[0].paid_minor,5000);assert.equal(r.body.items[0].penalties_minor,500);assert.equal(r.body.items[0].refunds_minor,1000);assert.equal(r.body.items[0].outstanding_minor,2500);
 // Void the concession -> outstanding becomes 5500
 r=await as('admin').post(`/api/fees/invoices/${ids.invoice}/concessions/${ids.concession}/void`,{reason:'Approved in error'});assert.equal(r.status,200,r.body.message);
 // Cross-school: school B admin cannot see this invoice's concessions
 r=await as('adminb').get(`/api/fees/invoices/${ids.invoice}/concessions`);assert.equal(r.status,404);
 // Parent cannot see other student's statement
 r=await as('parent').get(`/api/fees/students/${ids.s2}/statement`);assert.equal(r.status,404);
});

test('2.2 report cards: principal view, teacher remark, parent reads own child only',async()=>{
 // Use the seeded Default A-F grading scale (already has bands), create exam as draft, publish via SQL after marking.
 const scaleId='00000000-0000-4000-8000-000000000007';
 ids.exam=await insert("INSERT INTO exams(class_id,academic_year_id,grading_scale_id,name,start_date,end_date,status,created_by,updated_by) VALUES($1,$2,$3,'Mid term','2025-09-01','2025-09-02','draft',$4,$4) RETURNING id",[ids.class,ids.year,scaleId,accounts.admin]);
 ids.paper=await insert("INSERT INTO exam_papers(exam_id,subject_id,held_on,max_marks,pass_marks) VALUES($1,$2,'2025-09-02',100,35) RETURNING id",[ids.exam,ids.subject]);
 await query("INSERT INTO exam_candidates(exam_id,student_id,enrollment_id,section_id,class_id) VALUES($1,$2,$3,$4,$5)",[ids.exam,ids.s1,ids.s1enr,ids.section,ids.class]);
 await query("INSERT INTO exam_marks(exam_id,paper_id,student_id,outcome,score,updated_by) VALUES($1,$2,$3,'scored',88,$4)",[ids.exam,ids.paper,ids.s1,accounts.admin]);
 // end_date is 2025-09-02 which is in the past relative to 2026-11-17 today, so publish should succeed.
 await query("UPDATE exams SET status='published' WHERE id=$1",[ids.exam]);
 let r=await as('admin').get(`/api/report-cards?academic_year_id=${ids.year}`);assert.equal(r.status,200);assert.equal(r.body.items.length,2);
 r=await as('principal').get(`/api/report-cards?academic_year_id=${ids.year}`);assert.equal(r.status,200);
 r=await as('accountant').get('/api/report-cards');assert.equal(r.status,403);
 r=await as('admin').get(`/api/report-cards/${ids.s1}?academic_year_id=${ids.year}`);assert.equal(r.status,200);assert.equal(r.body.item.exam_results.length,1);assert.equal(r.body.item.exam_results[0].score,88);
 r=await as('teacher').put(`/api/report-cards/${ids.s1}/remarks`,{academic_year_id:ids.year,term:'Term 1',remark:'Good progress'});assert.equal(r.status,200,r.body.message);
 r=await as('parent').get(`/api/report-cards/${ids.s1}?academic_year_id=${ids.year}`);assert.equal(r.status,200);assert.equal(r.body.item.remarks.length,1);
 r=await as('parent').get(`/api/report-cards/${ids.s2}?academic_year_id=${ids.year}`);assert.equal(r.status,404);
 r=await as('adminb').get(`/api/report-cards/${ids.s1}?academic_year_id=${ids.year}`);assert.equal(r.status,404);
});

test('2.3 certificates: principal/admin issue and void; per-school numbering; cross-school blocked',async()=>{
 let r=await as('principal').post('/api/certificates',{type:'bonafide',student_id:ids.s1});assert.equal(r.status,201,r.body.message);ids.cert1=r.body.item.id;assert.ok(r.body.item.certificate_number>=1);
 r=await as('admin').post('/api/certificates',{type:'transfer',student_id:ids.s1});assert.equal(r.status,201);ids.cert2=r.body.item.id;assert.notEqual(r.body.item.certificate_number,ids.cert1);
 r=await as('accountant').post('/api/certificates',{type:'bonafide',student_id:ids.s1});assert.equal(r.status,403);
 r=await as('admin').get(`/api/certificates?student_id=${ids.s1}`);assert.equal(r.body.items.length,2);
 r=await as('admin').post(`/api/certificates/${ids.cert1}/void`,{reason:'Reissued'});assert.equal(r.status,200,r.body.message);assert.ok(r.body.item.voided);
 r=await as('admin').post(`/api/certificates/${ids.cert1}/void`,{reason:'Again'});assert.equal(r.status,409);
 r=await as('adminb').get(`/api/certificates/${ids.cert1}`);assert.equal(r.status,404);
});

test('2.4 ID cards and hall tickets: data-only endpoints scoped by role and school',async()=>{
 let r=await as('admin').get(`/api/cards/students/${ids.s1}/id-card`);assert.equal(r.status,200);assert.equal(r.body.item.admission_number,'ADM-S1');assert.ok(r.body.item.profile);
 r=await as('parent').get(`/api/cards/students/${ids.s1}/id-card`);assert.equal(r.status,200);
 r=await as('parent').get(`/api/cards/students/${ids.s2}/id-card`);assert.equal(r.status,403);
 r=await as('s1').get(`/api/cards/students/${ids.s2}/id-card`);assert.equal(r.status,403);
 r=await as('admin').get(`/api/cards/students/not-a-uuid/id-card`);assert.equal(r.status,400);
 r=await as('adminb').get(`/api/cards/students/${ids.s1}/id-card`);assert.equal(r.status,404);
 r=await as('admin').get(`/api/cards/exams/${ids.exam}/hall-tickets`);assert.equal(r.status,200);assert.equal(r.body.exam.id,ids.exam);assert.equal(r.body.candidates.length,1);
});

test('2.5 parent portal: parent sees only linked children; cross-school blocked',async()=>{
 let r=await as('parent').get('/api/portal/children');assert.equal(r.status,200);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].id,ids.s1);
 r=await as('admin').get('/api/portal/children');assert.equal(r.status,403);
 r=await as('parent').get(`/api/portal/children/${ids.s1}/overview`);assert.equal(r.status,200);assert.equal(r.body.item.student.admission_number,'ADM-S1');
 r=await as('parent').get(`/api/portal/children/${ids.s2}/overview`);assert.equal(r.status,403);
});

test('2.6 dashboard: principal gets admin-equivalent view; accountant blocked',async()=>{
 let r=await as('principal').get('/api/dashboard');assert.equal(r.status,200);assert.ok(r.body.calendar);
 r=await as('accountant').get('/api/dashboard');assert.equal(r.status,403);
 r=await as('adminb').get('/api/dashboard');assert.equal(r.status,200); // school B admin sees own school
});

test('2.7 academic: subject-combinations resource rejects cross-school references',async()=>{
 const otherSubject=await insert('INSERT INTO subjects(name,code) VALUES($1,$2) RETURNING id',['Phys','PHY']);
 const schoolBSubject=await insert(`INSERT INTO subjects(name,code,school_id) VALUES($1,$2,$3) RETURNING id`,['BSub','BSB',schoolB]);
 let r=await as('admin').post('/api/academic/subject-combinations',{class_id:ids.class,subject_id:otherSubject,is_compulsory:true});assert.equal(r.status,201,r.body.message);
 r=await as('admin').post('/api/academic/subject-combinations',{class_id:ids.class,subject_id:schoolBSubject,is_compulsory:true});assert.equal(r.status,400);
 r=await as('admin').get('/api/academic/subject-combinations?class_id='+ids.class);assert.equal(r.status,200);assert.equal(r.body.items.length,1);
 // adminB writing into school A's class: rejected (either by 403 at scope or 400 at trigger).
 r=await as('adminb').post('/api/academic/subject-combinations',{class_id:ids.class,subject_id:otherSubject,is_compulsory:true});
 assert.ok(r.status===400||r.status===403,'expected 400 or 403 for cross-school write, got '+r.status);
});

test('2.8 student import: dry run, all-or-nothing, credentials issued; profile aggregator',async()=>{
 const dupEmail='importdup@example.com';
 const existingUser=await insert("INSERT INTO users(name,email,password_hash,role) VALUES('Exists',$1,$2,'student') RETURNING id",[dupEmail,hash]);
 await query("INSERT INTO school_memberships(school_id,user_id,role,status,is_default) VALUES($1,$2,'student','active',true)",[schoolA,existingUser]);
 await query("INSERT INTO students(user_id,admission_number,admission_date) VALUES($1,'ADM-DUP','2025-01-01')",[existingUser]);
 let rows=[
  {admission_number:'IMP-1',name:'Import One',email:'imp1@example.com',admission_date:'2025-01-01'},
  {admission_number:'ADM-DUP',name:'Dup',email:'imp2@example.com',admission_date:'2025-01-01'}
 ];
 let r=await as('admin').post('/api/students/import',{dry_run:true,rows});assert.equal(r.status,200);assert.equal(r.body.applied,false);assert.equal(r.body.valid,false);assert.equal(r.body.results[1].errors.length,1);
 rows=[{admission_number:'IMP-A',name:'Import A',email:'impa@example.com',admission_date:'2025-01-01'},{admission_number:'IMP-B',name:'Import B',email:'impb@example.com',admission_date:'2025-01-01'}];
 r=await as('admin').post('/api/students/import',{dry_run:false,rows});assert.equal(r.status,200,r.body.message);assert.equal(r.body.applied,true);assert.equal(r.body.credentials.length,2);assert.ok(r.body.credentials[0].temporary_password);
 const newStudentId=r.body.credentials[0].student_id;
 // Re-importing the same rows fails because they now exist.
 r=await as('admin').post('/api/students/import',{dry_run:false,rows});assert.equal(r.status,200);assert.equal(r.body.valid,false);
 // Profile aggregator
 r=await as('admin').get(`/api/students/${newStudentId}/profile`);assert.equal(r.status,200);assert.equal(r.body.item.student.admission_number,'IMP-A');
 // Accountant cannot import
 r=await as('accountant').post('/api/students/import',{dry_run:true,rows:[]});assert.equal(r.status,403);
});
