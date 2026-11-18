import { pool } from '../config/db.js';
import * as model from '../models/settings.js';
import { fail } from './auth.js';
export const get=model.get;
export async function save(schoolId,userId,data){
 if(data.display_name&&data.display_name.trim().length===0)throw fail(400,'display_name required');
 return model.save(schoolId,userId,data);
}
export async function saveLogo(schoolId,userId,data){
 return model.saveLogo(schoolId,userId,data.mime,data.data);
}
export async function logoBytes(schoolId){return model.logoBytes(schoolId);}
export async function publicProfile(schoolId,client=pool){
 // Used by receipts/certificates/cards: returns display_name + principal_name + address or nulls.
 const row=await model.get(schoolId);
 if(!row)return {display_name:null,principal_name:null,address:null};
 return row;
}
