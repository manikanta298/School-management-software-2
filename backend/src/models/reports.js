import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
// 3.6 Reports endpoint. The query layer enforces school scoping; the format layer renders the rows.
// D7: xlsx via exceljs, pdf via pdfkit, csv hand-rolled.
export async function fetch(schoolId,name,query){
 const filters=['school_id=$1'];
 const values=[schoolId];
 if(query.academic_year_id){values.push(query.academic_year_id);filters.push(`academic_year_id=$${values.length}`);}
 if(query.class_id){values.push(query.class_id);filters.push(`class_id=$${values.length}`);}
 if(query.section_id){values.push(query.section_id);filters.push(`section_id=$${values.length}`);}
 if(query.from){values.push(query.from);filters.push(`issued_on>=$${values.length}`);}
 if(query.to){values.push(query.to);filters.push(`issued_on<=$${values.length}`);}
 switch(name){
  case 'students':
   return (await pool.query(`SELECT s.admission_number,u.name,u.email,s.lifecycle_status,s.admission_date::text AS admission_date,s.gender FROM students s JOIN users u ON u.id=s.user_id WHERE s.school_id=$1 ORDER BY s.admission_number`,[schoolId])).rows.map(r=>({admission_number:r.admission_number,name:r.name,email:r.email,lifecycle_status:r.lifecycle_status,admission_date:r.admission_date,gender:r.gender||''}));
  case 'attendance':
   if(!query.section_id)throw fail(400,'section_id is required for attendance report');
   return (await pool.query(`SELECT ar.attendance_date::text AS date,u.name AS student_name,s.admission_number,ae.status FROM attendance_entries ae JOIN attendance_registers ar ON ar.id=ae.register_id JOIN students s ON s.id=ae.student_id JOIN users u ON u.id=s.user_id WHERE ar.school_id=$1 AND ar.section_id=$2 AND ae.status<>'void' ORDER BY ar.attendance_date,s.admission_number`,[schoolId,query.section_id])).rows;
  case 'fees-collection':{
   const v2=[schoolId];
   let where='p.school_id=$1 AND p.reversed_at IS NULL';
   if(query.from){v2.push(query.from);where+=` AND p.paid_on>=$${v2.length}`;}
   if(query.to){v2.push(query.to);where+=` AND p.paid_on<=$${v2.length}`;}
   return (await pool.query(`SELECT p.receipt_number,i.invoice_number,u.name AS student_name,s.admission_number,p.amount_minor,p.paid_on::text AS paid_on,p.method,p.reference FROM fee_payments p JOIN fee_invoices i ON i.id=p.invoice_id JOIN students s ON s.id=i.student_id JOIN users u ON u.id=s.user_id WHERE ${where} ORDER BY p.paid_on DESC`,v2)).rows;
  }
  case 'defaulters':
   return (await pool.query(`SELECT u.name AS student_name,s.admission_number,i.invoice_number,i.amount_minor,coalesce((SELECT sum(amount_minor) FROM fee_payments p WHERE p.invoice_id=i.id AND p.reversed_at IS NULL),0)::bigint AS paid_minor,coalesce((SELECT sum(amount_minor) FROM fee_concessions c WHERE c.invoice_id=i.id AND c.voided_at IS NULL),0)::bigint AS concessions_minor,i.due_on::text AS due_on FROM fee_invoices i JOIN students s ON s.id=i.student_id JOIN users u ON u.id=s.user_id WHERE i.school_id=$1 AND i.voided_at IS NULL AND i.due_on<CURRENT_DATE AND coalesce((SELECT sum(amount_minor) FROM fee_payments p WHERE p.invoice_id=i.id AND p.reversed_at IS NULL),0) < i.amount_minor - coalesce((SELECT sum(amount_minor) FROM fee_concessions c WHERE c.invoice_id=i.id AND c.voided_at IS NULL),0) ORDER BY i.due_on,u.name`,[schoolId])).rows;
  case 'exam-results':
   if(!query.academic_year_id)throw fail(400,'academic_year_id is required for exam-results report');
   return (await pool.query(`SELECT ex.name AS exam_name,u.name AS student_name,s.admission_number,sub.name AS subject_name,paper.max_marks,m.outcome,m.score FROM exam_marks m JOIN exam_papers paper ON paper.id=m.paper_id JOIN exams ex ON ex.id=m.exam_id JOIN subjects sub ON sub.id=paper.subject_id JOIN students s ON s.id=m.student_id JOIN users u ON u.id=s.user_id WHERE ex.school_id=$1 AND ex.academic_year_id=$2 AND ex.status='published' ORDER BY ex.name,u.name,sub.name`,[schoolId,query.academic_year_id])).rows;
  default:
   throw fail(404,'Unknown report name');
 }
}
export function toCsv(rows){
 if(!rows.length)return '';
 const cols=Object.keys(rows[0]);
 const cell=v=>{const t=v==null?'':String(v);return /[",\n]/.test(t)?`"${t.replaceAll('"','""')}"`:t;};
 return [cols.join(','),...rows.map(r=>cols.map(c=>cell(r[c])).join(','))].join('\r\n')+'\r\n';
}
export async function toXlsx(rows,name){
 const ExcelJS=(await import('exceljs')).default;
 const wb=new ExcelJS.Workbook();
 const ws=wb.addWorksheet(name.slice(0,31));
 if(rows.length){
  const cols=Object.keys(rows[0]);
  ws.columns=cols.map(c=>({header:c,key:c,width:Math.max(12,Math.min(40,c.length+2))}));
  for(const r of rows)ws.addRow(r);
  ws.getRow(1).font={bold:true};
 }
 const buf=await wb.xlsx.writeBuffer();
 return Buffer.from(buf);
}
export async function toPdf(rows,name){
 const PDFKit=(await import('pdfkit')).default;
 const doc=new PDFKit({size:'A4',margin:30});
 const chunks=[];
 doc.on('data',c=>chunks.push(c));
 const p=new Promise(res=>doc.on('end',()=>res(Buffer.concat(chunks))));
 doc.fontSize(14).text(name,{align:'left'});
 doc.moveDown();
 if(rows.length){
  const cols=Object.keys(rows[0]);
  doc.fontSize(8);
  doc.text(cols.join('   |   '));
  doc.moveDown();
  for(const r of rows){doc.text(cols.map(c=>String(r[c]??'')).join('   |   '));}
 } else {doc.text('No rows.');}
 doc.end();
 return p;
}
