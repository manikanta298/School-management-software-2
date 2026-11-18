import { z } from 'zod';
const id=z.uuid();
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;},'Invalid calendar date');
const text=max=>z.string().trim().max(max).regex(/^[^<>\x00-\x1f]*$/u);
export const attendanceBody=z.object({staff_id:id,attendance_date:date,status:z.enum(['present','absent','leave','half_day']),note:text(200).nullable().optional().transform(v=>v||null)}).strict();
export const attendanceListQuery=z.object({from:date.optional(),to:date.optional(),staff_id:id.optional(),limit:z.coerce.number().int().min(1).max(100).default(25),offset:z.coerce.number().int().min(0).default(0)}).strict();
export const documentBody=z.object({name:text(120).min(1),mime:z.enum(['application/pdf','image/png','image/jpeg']),data:z.string().max(700000).regex(/^[A-Za-z0-9+/]+={0,2}$/,'base64 payload')}).strict();
