import { Router } from 'express';
import { moduleAccess } from '../middleware/permissions.js';
import { authenticate,authorize } from '../middleware/auth.js';
import { validate } from '../validators/auth.js';
import * as v from '../validators/settings.js';
import * as service from '../services/settings.js';
import { MODULES,permissionsFor } from '../config/permissions.js';
import { pool } from '../config/db.js';
export const settingsRouter=Router();
settingsRouter.use(authenticate,moduleAccess('settings',{convert:false}),(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
settingsRouter.get('/school',async(req,res)=>res.json({item:await service.get(req.schoolId)}));
settingsRouter.put('/school',authorize('admin'),validate(v.profileBody),async(req,res)=>res.json({item:await service.save(req.schoolId,req.user.id,req.body)}));
settingsRouter.put('/school/logo',authorize('admin'),validate(v.logoBody),async(req,res)=>res.json({item:await service.saveLogo(req.schoolId,req.user.id,req.body)}));
settingsRouter.get('/school/logo',async(req,res)=>{
 const row=await service.logoBytes(req.schoolId);
 if(!row)return res.status(404).json({message:'No logo uploaded'});
 res.set('Content-Type',row.logo_mime);res.set('Cache-Control','private, max-age=3600');res.send(row.logo_bytea);
});
settingsRouter.get('/permissions',async(req,res)=>{
 // Returns the acting user's effective matrix; admin sees all modules as view+manage.
 const matrix=req.user.realRole?permissionsFor(req.user.realRole):permissionsFor('admin');
 res.json({modules:MODULES,permissions:matrix});
});
// Batch 3.7: notification preferences (per user, per school).
settingsRouter.get('/notifications',async(req,res)=>{
 const {rows}=await pool.query('SELECT channel,enabled,digest FROM notification_preferences WHERE school_id=$1 AND user_id=$2 ORDER BY channel',[req.schoolId,req.user.id]);
 res.json({items:rows});
});
settingsRouter.put('/notifications',async(req,res,next)=>{
 const items=req.body?.preferences;
 if(!Array.isArray(items)||items.length===0||items.length>10)return res.status(400).json({message:'preferences array required'});
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  for(const it of items){
   if(!['in_app','email','sms'].includes(it.channel)||typeof it.enabled!=='boolean'||!['instant','daily','weekly'].includes(it.digest))throw Object.assign(new Error('Invalid preference'),{status:400});
   await c.query(`INSERT INTO notification_preferences(school_id,user_id,channel,enabled,digest) VALUES($1,$2,$3,$4,$5) ON CONFLICT(school_id,user_id,channel) DO UPDATE SET enabled=excluded.enabled,digest=excluded.digest`,[req.schoolId,req.user.id,it.channel,it.enabled,it.digest]);
  }
  await c.query('COMMIT');
  const {rows}=await c.query('SELECT channel,enabled,digest FROM notification_preferences WHERE school_id=$1 AND user_id=$2 ORDER BY channel',[req.schoolId,req.user.id]);
  res.json({items:rows});
 }catch(e){await c.query('ROLLBACK');next(e);}finally{c.release();}
});
