import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
// All carry-over queries reuse the existing scope rule from models/fees.js for the acting user.
// Balance components: concessions (subtract), payments (subtract), penalties (add), refunds (add back).
// Outstanding = amount_minor - concessions - payments + penalties - refunds. (refunds already deducted from "paid" via reversal path? No: refunds live in their own table.)
const componentSelect=`SELECT i.id,
 coalesce((SELECT sum(amount_minor) FROM fee_concessions c WHERE c.invoice_id=i.id AND c.voided_at IS NULL),0)::bigint AS concessions_minor,
 coalesce((SELECT sum(amount_minor) FROM fee_payments p WHERE p.invoice_id=i.id AND p.reversed_at IS NULL),0)::bigint AS paid_minor,
 coalesce((SELECT sum(amount_minor) FROM fee_penalties pn WHERE pn.invoice_id=i.id),0)::bigint AS penalties_minor,
 coalesce((SELECT sum(amount_minor) FROM fee_refunds r WHERE r.invoice_id=i.id),0)::bigint AS refunds_minor
 FROM fee_invoices i WHERE i.id=$1 AND i.school_id=$2`;
export async function components(schoolId,invoiceId,client=pool){
 const {rows:[r]}=await client.query(componentSelect,[invoiceId,schoolId]);
 if(!r)throw fail(404,'Invoice not found');
 return r;
}
export async function concessions(schoolId,invoiceId,query){
 return (await pool.query(`SELECT c.id,c.amount_minor,c.reason,c.approved_at,c.voided_at,c.void_reason,u.name AS approved_by_name,v.name AS voided_by_name
  FROM fee_concessions c JOIN users u ON u.id=c.approved_by LEFT JOIN users v ON v.id=c.voided_by
  WHERE c.invoice_id=$1 AND c.school_id=$2 ORDER BY c.approved_at DESC,c.id LIMIT $3 OFFSET $4`,[invoiceId,schoolId,query.limit,query.offset])).rows;
}
export async function addConcession(schoolId,invoiceId,userId,data){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  await c.query('SELECT id FROM fee_invoices WHERE id=$1 AND school_id=$2 FOR UPDATE',[invoiceId,schoolId]);
  const {rows:[row]}=await c.query('INSERT INTO fee_concessions(school_id,invoice_id,amount_minor,reason,approved_by) VALUES($1,$2,$3,$4,$5) RETURNING id,amount_minor,reason,approved_at',[schoolId,invoiceId,data.amount_minor,data.reason,userId]);
  await c.query("INSERT INTO fee_events(school_id,invoice_id,concession_id,kind,amount_minor,actor_id,reason) VALUES($1,$2,$3,'concession_recorded',$4,$5,$6)",[schoolId,invoiceId,row.id,data.amount_minor,userId,data.reason]);
  await c.query('COMMIT');
  return row;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function voidConcession(schoolId,invoiceId,concessionId,userId,reason){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  await c.query('SELECT id FROM fee_invoices WHERE id=$1 AND school_id=$2 FOR UPDATE',[invoiceId,schoolId]);
  const {rows:[row]}=await c.query('UPDATE fee_concessions SET voided_at=now(),voided_by=$3,void_reason=$4 WHERE id=$1 AND invoice_id=$2 AND school_id=$5 AND voided_at IS NULL RETURNING id,amount_minor,reason',[concessionId,invoiceId,userId,reason,schoolId]);
  if(!row)throw fail(409,'Concession not found or already voided');
  await c.query("INSERT INTO fee_events(school_id,invoice_id,concession_id,kind,amount_minor,actor_id,reason) VALUES($1,$2,$3,'concession_voided',$4,$5,$6)",[schoolId,invoiceId,row.id,row.amount_minor,userId,reason]);
  await c.query('COMMIT');
  return row;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function instalments(schoolId,invoiceId){
 return (await pool.query('SELECT id,due_on::text AS due_on,amount_minor,position FROM fee_instalments WHERE invoice_id=$1 AND school_id=$2 ORDER BY position,due_on',[invoiceId,schoolId])).rows;
}
export async function replaceInstalments(schoolId,invoiceId,userId,items){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  await c.query('SELECT id FROM fee_invoices WHERE id=$1 AND school_id=$2 FOR UPDATE',[invoiceId,schoolId]);
  await c.query('DELETE FROM fee_instalments WHERE invoice_id=$1 AND school_id=$2',[invoiceId,schoolId]);
  for(let i=0;i<items.length;i++){const it=items[i];await c.query('INSERT INTO fee_instalments(school_id,invoice_id,due_on,amount_minor,position) VALUES($1,$2,$3,$4,$5)',[schoolId,invoiceId,it.due_on,it.amount_minor,it.position||i]);}
  await c.query('COMMIT');
  return instalments(schoolId,invoiceId);
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function penalties(schoolId,invoiceId){
 return (await pool.query(`SELECT pn.id,pn.rule,pn.amount_minor,pn.applied_on::text AS applied_on,pn.reason,u.name AS applied_by_name,pn.created_at
  FROM fee_penalties pn JOIN users u ON u.id=pn.applied_by WHERE pn.invoice_id=$1 AND pn.school_id=$2 ORDER BY pn.applied_on DESC,pn.id`,[invoiceId,schoolId])).rows;
}
export async function addPenalty(schoolId,invoiceId,userId,data){
 const {rows:[row]}=await pool.query('INSERT INTO fee_penalties(school_id,invoice_id,rule,amount_minor,applied_on,applied_by,reason) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,rule,amount_minor,applied_on::text AS applied_on,reason,created_at',[schoolId,invoiceId,data.rule,data.amount_minor,data.applied_on,userId,data.reason]);
 await pool.query("INSERT INTO fee_events(school_id,invoice_id,penalty_id,kind,amount_minor,actor_id) VALUES($1,$2,$3,'penalty_applied',$4,$5)",[schoolId,invoiceId,row.id,data.amount_minor,userId]);
 return row;
}
export async function refunds(schoolId,invoiceId){
 return (await pool.query(`SELECT r.id,r.refund_number,r.payment_id,r.amount_minor,r.reason,r.refunded_at::text AS refunded_at,u.name AS refunded_by_name
  FROM fee_refunds r JOIN users u ON u.id=r.refunded_by WHERE r.invoice_id=$1 AND r.school_id=$2 ORDER BY r.refunded_at DESC,r.id`,[invoiceId,schoolId])).rows;
}
export async function addRefund(schoolId,invoiceId,userId,data){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  await c.query('SELECT id FROM fee_invoices WHERE id=$1 AND school_id=$2 FOR UPDATE',[invoiceId,schoolId]);
  const {rows:[row]}=await c.query('INSERT INTO fee_refunds(school_id,invoice_id,payment_id,amount_minor,reason,refunded_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,refund_number,amount_minor,reason,refunded_at::text AS refunded_at',[schoolId,invoiceId,data.payment_id,data.amount_minor,data.reason,userId]);
  await c.query("INSERT INTO fee_events(school_id,invoice_id,payment_id,refund_id,kind,amount_minor,actor_id,reason) VALUES($1,$2,$3,$4,'refund_issued',$5,$6,$7)",[schoolId,invoiceId,data.payment_id,row.id,data.amount_minor,userId,data.reason]);
  await c.query('COMMIT');
  return row;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function statement(user,schoolId,studentId,query){
 // Verify the acting user can see this student (reuse the student model scope).
 const {rows:[stu]}=await pool.query(`SELECT s.id FROM students s WHERE s.id=$1 AND s.school_id=$2 AND ${user.role==='admin'?'true':user.role==='student'?'s.user_id=$3':`EXISTS(SELECT 1 FROM student_parents sp JOIN parents p ON p.id=sp.parent_id AND p.school_id=sp.school_id WHERE sp.student_id=s.id AND p.user_id=$3)`}`,[studentId,schoolId,user.id]);
 if(!stu)throw fail(404,'Student not found');
 const params=[studentId,schoolId],filters=['i.student_id=$1','i.school_id=$2'];
 if(query.from){params.push(query.from);filters.push(`i.issued_on>=$${params.length}`);}
 if(query.to){params.push(query.to);filters.push(`i.issued_on<=$${params.length}`);}
 const {rows}=await pool.query(`SELECT i.id,i.invoice_number,i.title,i.amount_minor,i.currency,i.issued_on::text AS issued_on,i.due_on::text AS due_on,i.voided_at IS NOT NULL AS voided,
  coalesce((SELECT sum(amount_minor) FROM fee_concessions c WHERE c.invoice_id=i.id AND c.voided_at IS NULL),0)::bigint AS concessions_minor,
  coalesce((SELECT sum(amount_minor) FROM fee_payments p WHERE p.invoice_id=i.id AND p.reversed_at IS NULL),0)::bigint AS paid_minor,
  coalesce((SELECT sum(amount_minor) FROM fee_penalties pn WHERE pn.invoice_id=i.id),0)::bigint AS penalties_minor,
  coalesce((SELECT sum(amount_minor) FROM fee_refunds r WHERE r.invoice_id=i.id),0)::bigint AS refunds_minor
  FROM fee_invoices i WHERE ${filters.join(' AND ')} ORDER BY i.issued_on,i.id`,params);
 return rows.map(r=>({...r,outstanding_minor:r.amount_minor-Number(r.concessions_minor)-Number(r.paid_minor)+Number(r.penalties_minor)-Number(r.refunds_minor)}));
}
