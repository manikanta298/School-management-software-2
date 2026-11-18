import { z } from 'zod';
const id=z.uuid();
const text=max=>z.string().trim().max(max).regex(/^[^<>\x00-\x1f]*$/u);
export const issueBody=z.object({type:z.enum(['bonafide','transfer','study','character']),student_id:id,reason:text(200).nullable().optional().transform(v=>v||null)}).strict();
export const voidBody=z.object({reason:text(200).min(3)}).strict();
export const listQuery=z.object({student_id:id.optional(),type:z.enum(['bonafide','transfer','study','character']).optional(),limit:z.coerce.number().int().min(1).max(100).default(25),offset:z.coerce.number().int().min(0).default(0)}).strict();
