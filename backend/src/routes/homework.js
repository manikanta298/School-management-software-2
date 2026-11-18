import { Router } from 'express';
import { moduleAccess } from '../middleware/permissions.js';
import { authenticate,authorize } from '../middleware/auth.js';
import { validate } from '../validators/auth.js';
import * as v from '../validators/homework.js';
import * as ev from '../validators/homeworkExt.js';
import * as model from '../models/homework.js';
import * as ext from '../models/homeworkExt.js';
import { pool } from '../config/db.js';
import { fail } from '../services/auth.js';
export const homeworkRouter=Router();
homeworkRouter.use(authenticate,moduleAccess('homework'),(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
homeworkRouter.param('id',(_req,res,next,value)=>v.id.safeParse(value).success?next():res.status(400).json({message:'Invalid record ID'}));
const staff=authorize('admin','teacher'),student=authorize('student');
const visible=async(user,id)=>{const item=await model.find(user,id);if(!item)throw fail(404,'Homework not found');return item;};
// Teachers may change only homework they posted; the 404 above already hides other classes' items.
const editable=async(user,id)=>{await visible(user,id);const row=await model.raw(id);if(user.role==='teacher'&&row.created_by!==user.id)throw fail(403,'Only the posting teacher can change this homework');return row;};
homeworkRouter.get('/',async(req,res)=>{const q=v.listQuery.safeParse(req.query);if(!q.success)return res.status(400).json({message:'Invalid query'});res.json({items:await model.list(req.user,q.data)});});
homeworkRouter.get('/:id',async(req,res)=>res.json({item:await visible(req.user,req.params.id)}));
homeworkRouter.post('/',staff,validate(v.create),async(req,res)=>{
 if(!await model.sectionExists(req.user,req.body.section_id))throw fail(404,'Section not found');
 if(!await model.mayTeach(req.user,req.body.section_id,req.body.subject_id))throw fail(403,'You are not assigned to teach this subject in this class');
 const saved=await model.create(req.user,req.body);res.status(201).json({item:await visible(req.user,saved.id)});
});
homeworkRouter.put('/:id',staff,validate(v.update),async(req,res)=>{await editable(req.user,req.params.id);if(!await model.update(req.params.id,req.body))throw fail(409,'Archived homework cannot be edited');res.json({item:await visible(req.user,req.params.id)});});
homeworkRouter.post('/:id/archive',staff,async(req,res)=>{await editable(req.user,req.params.id);await model.archive(req.params.id);res.status(204).end();});
homeworkRouter.post('/:id/complete',student,async(req,res)=>{await visible(req.user,req.params.id);await model.complete(req.user,req.params.id);res.json({item:await visible(req.user,req.params.id)});});
homeworkRouter.delete('/:id/complete',student,async(req,res)=>{await visible(req.user,req.params.id);await model.uncomplete(req.user,req.params.id);res.json({item:await visible(req.user,req.params.id)});});
// Batch 3.3: attachments, submissions, feedback
homeworkRouter.param('attachId',(_req,res,next,value)=>v.id.safeParse(value).success?next():res.status(400).json({message:'Invalid attachment ID'}));
homeworkRouter.param('studentId',(_req,res,next,value)=>v.id.safeParse(value).success?next():res.status(400).json({message:'Invalid student ID'}));
homeworkRouter.get('/:id/attachments',async(req,res,next)=>{try{await visible(req.user,req.params.id);res.json({items:await ext.attachments(req.schoolId,req.params.id)});}catch(e){next(e);}});
homeworkRouter.post('/:id/attachments',staff,validate(ev.attachmentBody),async(req,res,next)=>{try{await editable(req.user,req.params.id);const buf=Buffer.from(req.body.data,'base64');if(buf.length>524288)throw fail(400,'Attachment too large');res.status(201).json({item:await ext.addAttachment(req.schoolId,req.params.id,req.user.id,req.body.name,req.body.mime,buf)});}catch(e){next(e);}});
homeworkRouter.get('/:id/attachments/:attachId',async(req,res,next)=>{try{await visible(req.user,req.params.id);const row=await ext.attachmentBytes(req.schoolId,req.params.id,req.params.attachId);if(!row)return res.status(404).json({message:'Attachment not found'});res.set('Content-Type',row.mime);res.set('Cache-Control','private, max-age=3600');res.send(row.bytea);}catch(e){next(e);}});
homeworkRouter.get('/:id/submissions',staff,async(req,res,next)=>{try{await visible(req.user,req.params.id);res.json({items:await ext.submissions(req.schoolId,req.params.id)});}catch(e){next(e);}});
homeworkRouter.post('/:id/submissions',student,validate(ev.submissionBody),async(req,res,next)=>{try{await visible(req.user,req.params.id);const {rows:[stu]}=await pool.query('SELECT id FROM students WHERE user_id=$1 AND school_id=$2',[req.user.id,req.schoolId]);if(!stu)throw fail(403,'No student profile for this account');const buf=Buffer.from(req.body.data,'base64');if(buf.length>524288)throw fail(400,'Submission too large');res.status(201).json({item:await ext.addSubmission(req.schoolId,req.params.id,stu.id,req.user.id,req.body.name,req.body.mime,buf,req.body.note)});}catch(e){next(e);}});
homeworkRouter.put('/:id/submissions/:studentId/feedback',staff,validate(ev.feedbackBody),async(req,res,next)=>{try{await visible(req.user,req.params.id);res.json({item:await ext.feedback(req.schoolId,req.params.id,req.params.studentId,req.user.id,req.body.feedback)});}catch(e){next(e);}});
homeworkRouter.use((err,_req,res,next)=>{
 if(err.code==='23503')return res.status(409).json({message:'Unknown subject or section'});
 if(err.code==='23514')return res.status(400).json({message:'The due date cannot precede the assigned date'});
 next(err);
});
