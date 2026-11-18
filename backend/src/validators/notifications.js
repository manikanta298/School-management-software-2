import { z } from 'zod';
const id=z.uuid();
const text=max=>z.string().trim().max(max).regex(/^[^<>\x00-\x1f]*$/u);
export const documentBody=z.object({name:text(120).min(1),mime:z.enum(['application/pdf','image/png','image/jpeg']),data:z.string().max(700000).regex(/^[A-Za-z0-9+/]+={0,2}$/,'base64 payload')}).strict();
export const outboxQuery=z.object({status:z.enum(['pending','sent','failed','dead']).optional(),event_type:text(40).optional(),limit:z.coerce.number().int().min(1).max(100).default(25),offset:z.coerce.number().int().min(0).default(0)}).strict();
