import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { pool } from '../config/db.js';
import { fail } from './auth.js';
import { env } from '../config/env.js';
const ISSUER='School Management';
// 4.3 (6.5) MFA enrollment + verification (TOTP per D8). Required for admin and principal.
export async function enroll(userId){
 // If already enrolled, refresh the secret only after explicit unenroll.
 const secret=speakeasy.generateSecret({length:20,name:ISSUER});
 await pool.query(`INSERT INTO user_mfa_secrets(user_id,secret) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret, enabled_at=now(), last_used_at=null`,[userId,secret.base32]);
 const otpauth=secret.otpauth_url;
 const qr=await QRCode.toDataURL(otpauth);
 return {secret:secret.base32,qr_url:qr,otpauth_url:otpauth};
}
export async function verify(userId,token){
 const {rows:[row]}=await pool.query('SELECT secret,last_used_at FROM user_mfa_secrets WHERE user_id=$1',[userId]);
 if(!row)throw fail(404,'MFA not enrolled');
 const ok=speakeasy.totp.verify({secret:row.secret,encoding:'base32',token:token,window:1});
 if(!ok)throw fail(400,'Invalid TOTP code');
 await pool.query('UPDATE user_mfa_secrets SET last_used_at=now() WHERE user_id=$1',[userId]);
 return {verified:true};
}
export async function unenroll(userId){
 await pool.query('DELETE FROM user_mfa_secrets WHERE user_id=$1',[userId]);
 return {unenrolled:true};
}
export async function status(userId){
 const {rows:[row]}=await pool.query('SELECT enabled_at,last_used_at FROM user_mfa_secrets WHERE user_id=$1',[userId]);
 return {enrolled:!!row,last_used_at:row?.last_used_at||null};
}
