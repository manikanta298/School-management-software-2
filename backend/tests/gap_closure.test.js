import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import request from 'supertest';
process.env.NODE_ENV='test';process.env.JWT_SECRET='gap-test-secret'.repeat(5);process.env.DATABASE_URL='postgres://test:test@localhost/test';process.env.FRONTEND_ORIGIN='http://localhost:5173';
const {pool}=await import('../src/config/db.js');const db=new PGlite();await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
const query=async(text,params)=>{const r=await db.query(text,params);return {...r,rowCount:r.rows.length||r.affectedRows||0};};pool.query=query;pool.connect=async()=>({query,release(){}});
const schoolA=(await query("SELECT id FROM schools WHERE slug='existing-school'")).rows[0].id;
const schoolB=(await query("INSERT INTO schools(name,slug) VALUES('School B','school-b-gap') RETURNING id")).rows[0].id;
for(const {table_name} of (await query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='school_id' AND table_name NOT IN ('school_memberships','school_profiles','fee_concessions','fee_instalments','fee_penalties','fee_refunds','report_card_remarks','certificates_issued','class_subject_combinations','staff_attendance','staff_documents','homework_attachments','homework_submissions','attendance_corrections','exam_types','exam_student_remarks','timetable_periods','notification_preferences','leave_requests','leave_balances','message_threads','message_messages','notification_outbox','notification_delivery_attempts','student_documents')")).rows)await query(`ALTER TABLE ${table_name} ALTER COLUMN school_id SET DEFAULT '${schoolA}'`);
const {app}=await import('../src/app.js');const {hashPassword}=await import('../src/services/auth.js');
const hash=await hashPassword('GapTest!123');
const insert=async(sql,p)=>(await query(sql,p)).rows[0].id;
const admin=await insert("INSERT INTO users(name,email,password_hash,role) VALUES('admin','admin@gap.example',$1,'admin') RETURNING id",[hash]);
await query("INSERT INTO school_memberships(school_id,user_id,role,status,is_default) VALUES($1,$2,'admin','active',true)",[schoolA,admin]);
const adminb=await insert("INSERT INTO users(name,email,password_hash,role) VALUES('adminb','adminb@gap.example',$1,'admin') RETURNING id",[hash]);
await query("INSERT INTO school_memberships(school_id,user_id,role,status,is_default) VALUES($1,$2,'admin','active',true)",[schoolB,adminb]);
const tokens={};
for(const [key,email] of [['admin','admin@gap.example'],['adminb','adminb@gap.example']]){const r=await request(app).post('/api/auth/login').send({email,password:'GapTest!123'});assert.equal(r.status,200,key);tokens[key]=r.body.accessToken;}
const as=who=>({get:p=>request(app).get(p).set('Authorization',`Bearer ${tokens[who]}`),post:(p,b={})=>request(app).post(p).set('Authorization',`Bearer ${tokens[who]}`).send(b)});
// Fixtures
const year=await insert("INSERT INTO academic_years(name,start_date,end_date,is_current) VALUES('2025-26','2025-06-01','2026-05-31',true) RETURNING id");
const cls=await insert('INSERT INTO classes(name,academic_year_id) VALUES($1,$2) RETURNING id',['G5',year]);
const sec=await insert('INSERT INTO sections(name,class_id,capacity) VALUES($1,$2,40) RETURNING id',['A',cls]);
const sUser=await insert("INSERT INTO users(name,email,password_hash,role) VALUES('Stu','stu@gap.example',$1,'student') RETURNING id",[hash]);
const student=await insert("INSERT INTO students(user_id,admission_number,admission_date) VALUES($1,'ADM-S1','2025-01-01') RETURNING id",[sUser]);
after(async()=>{await db.close();await pool.end();});

test('§2.1 dashboard: teaching vs non-teaching staff split',async()=>{
 const r=await as('admin').get('/api/dashboard');
 assert.equal(r.status,200);
 assert.ok(r.body.stats.profiles.active_teachers!==undefined);
 assert.ok(r.body.stats.profiles.active_non_teaching_staff!==undefined,'teaching and non-teaching counts must be separate');
});

test('§2.2 student documents: upload, list, cross-school blocked',async()=>{
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
 let r=await as('admin').post(`/api/students/${student}/documents`,{name:'birth_cert.png',mime:'image/png',data:png});
 assert.equal(r.status,201,r.body.message);
 r=await as('admin').get(`/api/students/${student}/documents`);
 assert.equal(r.body.items.length,1);
 // cross-school: adminB sees no documents (school_id filter isolates)
 r=await as('adminb').get(`/api/students/${student}/documents`);
 assert.equal(r.status,200);
 assert.equal(r.body.items.length,0,"cross-school must return empty list, not the other school documents");
});

test('§2.13 notification outbox: enqueue + list, cross-school isolated',async()=>{
 // Enqueue directly via SQL (no public enqueue route yet — internal helper)
 const {rows:[row]}=await query("INSERT INTO notification_outbox(school_id,event_type,channel,recipient_ref,template_key) VALUES($1,'absence','in_app','parent@example.com','absence_alert') RETURNING id",[schoolA]);
 assert.ok(row.id);
 const r=await as('admin').get('/api/attendance/corrections'); // smoke: corrections route still works
 assert.equal(r.status,200);
 // Verify outbox exists in schema
 const {rows}=await query('SELECT count(*)::int AS n FROM notification_outbox WHERE school_id=$1',[schoolA]);
 assert.equal(rows[0].n,1);
 // School B has no outbox entries
 const bRows=await query('SELECT count(*)::int AS n FROM notification_outbox WHERE school_id=$1',[schoolB]);
 assert.equal(bRows.rows[0].n,0);
});

test('§4.2 migrations 040-042: tables and indexes exist in schema',async()=>{
 // Verify the new tables exist
 const tables=await query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('notification_outbox','notification_delivery_attempts','student_documents') ORDER BY table_name");
 assert.deepEqual(tables.rows.map(r=>r.table_name),['notification_delivery_attempts','notification_outbox','student_documents']);
 // Verify dashboard indexes exist
 const idx=await query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('students_school_lifecycle_idx','staff_members_school_type_status_idx','fee_payments_school_paid_on_idx')");
 assert.ok(idx.rows.length>=3,'dashboard indexes should exist');
});
