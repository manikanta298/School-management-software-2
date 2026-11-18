import { Router } from 'express';
import { moduleAccess } from '../middleware/permissions.js';
import { authenticate,authorize } from '../middleware/auth.js';
import { validate } from '../validators/auth.js';
import * as v from '../validators/certificates.js';
import * as model from '../models/certificates.js';
export const certificatesRouter=Router();
certificatesRouter.use(authenticate,moduleAccess('certificates'),authorize('admin','principal'),(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
certificatesRouter.param('id',(req,res,next,value)=>v.listQuery.shape.student_id.safeParse(value).success?next():res.status(400).json({message:'Invalid record ID'}));
const query=(req,res,next)=>{const r=v.listQuery.safeParse(req.query);if(!r.success)return res.status(400).json({message:'Invalid query'});req.certQuery=r.data;next();};
certificatesRouter.get('/',query,async(req,res)=>res.json({items:await model.list(req.schoolId,req.certQuery)}));
certificatesRouter.post('/',validate(v.issueBody),async(req,res,next)=>{try{res.status(201).json({item:await model.issue(req.schoolId,req.user.id,req.body)});}catch(e){next(e);}});
certificatesRouter.get('/:id',async(req,res,next)=>{try{res.json({item:await model.find(req.schoolId,req.params.id)});}catch(e){next(e);}});
certificatesRouter.post('/:id/void',validate(v.voidBody),async(req,res,next)=>{try{res.json({item:await model.void_(req.schoolId,req.params.id,req.user.id,req.body.reason)});}catch(e){next(e);}});
certificatesRouter.use((err,_req,res,next)=>{
 if(err.code==='23503')return res.status(409).json({message:'Student not found in this school'});
 if(err.code==='23514')return res.status(400).json({message:'Invalid certificate input'});
 next(err);
});
