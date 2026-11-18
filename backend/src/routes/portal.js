import { Router } from 'express';
import { authenticate,authorize } from '../middleware/auth.js';
import * as model from '../models/portal.js';
export const portalRouter=Router();
portalRouter.use(authenticate,authorize('parent'),(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
portalRouter.param('studentId',(req,res,next,value)=>/^[0-9a-f-]{36}$/.test(value)?next():res.status(400).json({message:'Invalid student ID'}));
portalRouter.get('/children',async(req,res)=>res.json({items:await model.children(req.user.id,req.schoolId)}));
portalRouter.get('/children/:studentId/overview',async(req,res,next)=>{try{res.json({item:await model.overview(req.user.id,req.schoolId,req.params.studentId)});}catch(e){next(e);}});
