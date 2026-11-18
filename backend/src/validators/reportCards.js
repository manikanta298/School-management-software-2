import { z } from 'zod';
const id=z.uuid();
const text=max=>z.string().trim().max(max).regex(/^[^<>\x00-\x1f]*$/u);
export const remarkBody=z.object({academic_year_id:id,term:text(40),remark:text(500).min(1)}).strict();
export const listQuery=z.object({academic_year_id:id.optional(),section_id:id.optional(),limit:z.coerce.number().int().min(1).max(200).default(50),offset:z.coerce.number().int().min(0).default(0)}).strict();
