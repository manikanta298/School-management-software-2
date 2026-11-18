import { z } from 'zod';
const time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const text=max=>z.string().trim().max(max).regex(/^[^<>\x00-\x1f]*$/u);
export const periodBody=z.object({day_of_week:z.number().int().min(1).max(7),period_index:z.number().int().min(1).max(20),start_time:time,end_time:time,is_break:z.boolean().default(false),label:text(40).nullable().optional().transform(v=>v||null)}).strict().refine(v=>v.end_time>v.start_time,{message:'End time must follow start time',path:['end_time']});
export const periodsBody=z.object({periods:z.array(periodBody).max(140)}).strict();
