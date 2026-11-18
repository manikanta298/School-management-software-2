import { pool } from '../config/db.js';
export async function get(schoolId){
 return (await pool.query('SELECT school_id,display_name,address,phone,email,principal_name,letterhead_text,logo_mime,octet_length(logo_bytea) AS logo_size,updated_at FROM school_profiles WHERE school_id=$1',[schoolId])).rows[0]||null;
}
export async function save(schoolId,userId,data){
 const values=[schoolId,data.display_name,data.address,data.phone,data.email,data.principal_name,data.letterhead_text,userId];
 return (await pool.query(`INSERT INTO school_profiles(school_id,display_name,address,phone,email,principal_name,letterhead_text,updated_by)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8)
  ON CONFLICT(school_id) DO UPDATE SET display_name=excluded.display_name,address=excluded.address,phone=excluded.phone,email=excluded.email,principal_name=excluded.principal_name,letterhead_text=excluded.letterhead_text,updated_by=excluded.updated_by,updated_at=now()
  RETURNING school_id,display_name,address,phone,email,principal_name,letterhead_text,logo_mime,octet_length(logo_bytea) AS logo_size,updated_at`,values)).rows[0];
}
export async function saveLogo(schoolId,userId,mime,data){
 const buffer=Buffer.from(data,'base64');
 if(buffer.length>524288)throw Object.assign(new Error('Logo too large'),{status:400});
 return (await pool.query(`INSERT INTO school_profiles(school_id,display_name,logo_mime,logo_bytea,updated_by) VALUES($1,$2,$3,$4,$5)
  ON CONFLICT(school_id) DO UPDATE SET logo_mime=excluded.logo_mime,logo_bytea=excluded.logo_bytea,updated_by=excluded.updated_by,updated_at=now()
  RETURNING school_id,logo_mime,octet_length(logo_bytea) AS logo_size`,[schoolId,'My School',mime,buffer,userId])).rows[0];
}
export async function logoBytes(schoolId){
 return (await pool.query('SELECT logo_bytea,logo_mime FROM school_profiles WHERE school_id=$1 AND logo_bytea IS NOT NULL',[schoolId])).rows[0]||null;
}
