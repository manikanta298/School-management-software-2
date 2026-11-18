import { Router } from 'express';
import { authenticate,authorize } from '../middleware/auth.js';
import * as v from '../validators/leave.js';
import * as model from '../models/leave.js';
export const leaveRouter=Router();
leaveRouter.use(authenticate,(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
const validate=schema=>(req,res,next)=>{const r=schema.safeParse(req.body);if(!r.success)return res.status(400).json({message:'Invalid input'});req.body=r.data;next();};
const idParam=(req,res,next,value)=>v.leaveBody.shape.person_id.safeParse(value).success?next():res.status(400).json({message:'Invalid record ID'});
leaveRouter.param('id',idParam);
// Leave requests: admin/principal/teacher list; admin approves; teachers/parents can create on behalf.
leaveRouter.get('/',authorize('admin','principal','teacher'),async(req,res)=>{const q=v.leaveListQuery.safeParse(req.query);if(!q.success)return res.status(400).json({message:'Invalid query'});res.json({items:await model.listLeave(req.schoolId,q.data)});});
leaveRouter.post('/',authorize('admin','principal','teacher','parent'),validate(v.leaveBody),async(req,res,next)=>{try{res.status(201).json({item:await model.createLeave(req.schoolId,req.user.id,req.body)});}catch(e){next(e);}});
leaveRouter.post('/:id/approve',authorize('admin'),validate(v.reviewBody),async(req,res,next)=>{try{res.json({item:await model.reviewLeave(req.schoolId,req.params.id,req.user.id,'approved',req.body.note)});}catch(e){next(e);}});
leaveRouter.post('/:id/reject',authorize('admin'),validate(v.reviewBody),async(req,res,next)=>{try{res.json({item:await model.reviewLeave(req.schoolId,req.params.id,req.user.id,'rejected',req.body.note)});}catch(e){next(e);}});
// Leave balances (staff only)
leaveRouter.get('/balances',authorize('admin','principal'),async(req,res)=>{res.json({items:await model.listBalances(req.schoolId,req.query.staff_id)});});
leaveRouter.post('/balances',authorize('admin'),validate(v.balanceBody),async(req,res,next)=>{try{res.status(201).json({item:await model.saveBalance(req.schoolId,null,req.body)});}catch(e){next(e);}});
leaveRouter.put('/balances/:id',authorize('admin'),validate(v.balanceBody),async(req,res,next)=>{try{res.json({item:await model.saveBalance(req.schoolId,req.params.id,req.body)});}catch(e){next(e);}});
