import { z } from 'zod';
const id=z.uuid();
const text=max=>z.string().trim().max(max).regex(/^[^<>\x00-\x1f]*$/u);
export const attachmentBody=z.object({name:text(120).min(1),mime:z.enum(['application/pdf','image/png','image/jpeg']),data:z.string().max(700000).regex(/^[A-Za-z0-9+/]+={0,2}$/,'base64 payload')}).strict();
export const submissionBody=z.object({name:text(120).min(1),mime:z.enum(['application/pdf','image/png','image/jpeg']),data:z.string().max(700000).regex(/^[A-Za-z0-9+/]+={0,2}$/,'base64 payload'),note:text(500).nullable().optional().transform(v=>v||null)}).strict();
export const feedbackBody=z.object({feedback:text(1000).min(1)}).strict();
