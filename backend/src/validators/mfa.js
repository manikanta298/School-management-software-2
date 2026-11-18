import { z } from 'zod';
export const verifyBody=z.object({token:z.string().trim().regex(/^\d{6}$/,'6-digit code required')}).strict();
