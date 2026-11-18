import { z } from 'zod';
const text=max=>z.string().trim().max(max).regex(/^[^<>\x00-\x1f]*$/u);
export const typeBody=z.object({name:text(60).min(1),code:text(20).min(1).toUpperCase().regex(/^[A-Z0-9_-]{1,20}$/)}).strict();
export const remarkBody=z.object({remark:text(500).min(1)}).strict();
