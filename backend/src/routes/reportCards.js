import { Router } from 'express';
import { moduleAccess } from '../middleware/permissions.js';
import { authenticate,authorize } from '../middleware/auth.js';
import { validate } from '../validators/auth.js';
import * as v from '../validators/reportCards.js';
import * as model from '../models/reportCards.js';
import * as feesModel from '../models/fees.js'; // not used but reused pattern
import { pool } from '../config/db.js';
export const reportCardsRouter=Router();
reportCardsRouter.use(authenticate,moduleAccess('report_cards'),authorize('admin','teacher','student','parent'),(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
reportCardsRouter.param('studentId',(req,res,next,value)=>v.listQuery.shape.academic_year_id.safeParse(value).success?next():res.status(400).json({message:'Invalid student ID'}));
const query=(req,res,next)=>{const r=v.listQuery.safeParse(req.query);if(!r.success)return res.status(400).json({message:'Invalid query'});req.reportQuery=r.data;next();};
reportCardsRouter.get('/',query,async(req,res)=>res.json({items:await model.list(req.user,req.schoolId,req.reportQuery)}));
reportCardsRouter.get('/:studentId',async(req,res,next)=>{const r=v.listQuery.shape.academic_year_id.optional().safeParse(req.query.academic_year_id);if(!r.success)return res.status(400).json({message:'Invalid academic_year_id'});const ayId=req.query.academic_year_id||await currentYear(req.schoolId);if(!ayId)return res.status(400).json({message:'academic_year_id is required when no current year is set'});try{res.json({item:await model.detail(req.user,req.schoolId,req.params.studentId,ayId)});}catch(e){next(e);}});
reportCardsRouter.put('/:studentId/remarks',validate(v.remarkBody),async(req,res,next)=>{try{res.json({item:await model.upsertRemark(req.schoolId,req.params.studentId,req.user.id,req.body)});}catch(e){next(e);}});
async function currentYear(schoolId){const {rows:[y]}=await pool.query('SELECT id FROM academic_years WHERE school_id=$1 AND is_current=true LIMIT 1',[schoolId]);return y?.id||null;}
reportCardsRouter.use((err,_req,res,next)=>{
 if(err.code==='23503')return res.status(409).json({message:'Student, academic year or teacher not found in this school'});
 if(err.code==='23514')return res.status(400).json({message:'Invalid remark input'});
 next(err);
});
