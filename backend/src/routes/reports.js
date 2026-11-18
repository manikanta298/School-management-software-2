import { Router } from 'express';
import { authenticate,authorize } from '../middleware/auth.js';
import { moduleAccess } from '../middleware/permissions.js';
import * as model from '../models/reports.js';
const ALLOWED=new Set(['students','attendance','fees-collection','defaulters','exam-results']);
export const reportsRouter=Router();
reportsRouter.use(authenticate,authorize('admin','principal','accountant'),(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
reportsRouter.param('name',(req,res,next,value)=>ALLOWED.has(value)?next():res.status(404).json({message:'Unknown report name'}));
reportsRouter.get('/:name',async(req,res,next)=>{
 const format=(req.query.format||'csv').toLowerCase();
 const query={academic_year_id:req.query.academic_year_id,section_id:req.query.section_id,class_id:req.query.class_id,from:req.query.from,to:req.query.to};
 try{
  const rows=await model.fetch(req.schoolId,req.params.name,query);
  if(format==='csv'){res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${req.params.name}.csv"`});return res.send(model.toCsv(rows));}
  if(format==='xlsx'){const buf=await model.toXlsx(rows,req.params.name);res.set({'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${req.params.name}.xlsx"`,'Content-Length':buf.length});return res.send(buf);}
  if(format==='pdf'){const buf=await model.toPdf(rows,req.params.name);res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${req.params.name}.pdf"`,'Content-Length':buf.length});return res.send(buf);}
  res.status(400).json({message:'Unsupported format'});
 }catch(e){next(e);}
});
