import { Router } from 'express';
import { moduleAccess } from '../middleware/permissions.js';
import { authenticate,authorize } from '../middleware/auth.js';
import { validate } from '../validators/auth.js';
import * as v from '../validators/staff.js';
import * as ev from '../validators/staffExt.js';
import * as model from '../models/staff.js';
import * as ext from '../models/staffExt.js';
import { fail } from '../services/auth.js';
export const staffRouter=Router();
staffRouter.use(authenticate,moduleAccess('staff'),authorize('admin'),(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
staffRouter.param('id',(_req,res,next,value)=>v.id.safeParse(value).success?next():res.status(400).json({message:'Invalid record ID'}));
const found=async(schoolId,id)=>{const item=await model.find(schoolId,id);if(!item)throw fail(404,'Record not found');return item;};
staffRouter.get('/',async(req,res)=>{const q=v.listQuery.safeParse(req.query);if(!q.success)return res.status(400).json({message:'Invalid query'});res.json({items:await model.list(req.schoolId,q.data)});});
// Batch 3.1: staff attendance (registered before /:id so it isn't shadowed by the id param)
staffRouter.get('/attendance',async(req,res)=>{const q=ev.attendanceListQuery.safeParse(req.query);if(!q.success)return res.status(400).json({message:'Invalid query'});res.json({items:await ext.attendanceList(req.schoolId,q.data)});});
staffRouter.put('/attendance',validate(ev.attendanceBody),async(req,res,next)=>{try{res.json({item:await ext.saveAttendance(req.schoolId,req.user.id,req.body)});}catch(e){next(e);}});
staffRouter.get('/:id',async(req,res)=>res.json({item:await found(req.schoolId,req.params.id)}));
staffRouter.post('/',validate(v.staffBody),async(req,res)=>{const {id}=await model.save(req.schoolId,null,req.body);res.status(201).json({item:await found(req.schoolId,id)});});
staffRouter.put('/:id',validate(v.staffBody),async(req,res)=>{const saved=await model.save(req.schoolId,req.params.id,req.body);if(!saved)throw fail(404,'Record not found');res.json({item:await found(req.schoolId,saved.id)});});
staffRouter.delete('/:id',async(req,res)=>{if(!await model.remove(req.schoolId,req.params.id))throw fail(404,'Record not found');res.status(204).end();});
// Batch 3.1: staff documents
staffRouter.get('/:id/documents',async(req,res,next)=>{try{await found(req.schoolId,req.params.id);res.json({items:await ext.documents(req.schoolId,req.params.id)});}catch(e){next(e);}});
staffRouter.post('/:id/documents',validate(ev.documentBody),async(req,res,next)=>{try{await found(req.schoolId,req.params.id);const buf=Buffer.from(req.body.data,'base64');if(buf.length>524288)throw fail(400,'Document too large');res.status(201).json({item:await ext.addDocument(req.schoolId,req.params.id,req.user.id,req.body.name,req.body.mime,buf)});}catch(e){next(e);}});
staffRouter.use((err,_req,res,next)=>{
 if(err.code==='23505')return res.status(409).json({message:'Employee number already exists in this school, or attendance already recorded (use PUT to update)'});
 if(err.code==='23514')return res.status(400).json({message:'Invalid staff details. Check the joining date, phone, email and employee number.'});
 if(err.code==='23503')return res.status(409).json({message:'Staff record is referenced by another record'});
 next(err);
});
