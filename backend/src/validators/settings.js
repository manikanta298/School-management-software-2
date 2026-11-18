import { z } from 'zod';
const text=max=>z.string().trim().max(max).regex(/^[^<>\x00-\x1f]*$/u);
export const profileBody=z.object({
 display_name:text(120).min(1),
 address:text(500).nullable().optional().transform(v=>v||null),
 phone:z.string().trim().regex(/^[+0-9() .-]{7,30}$/).nullable().optional().transform(v=>v||null),
 email:z.string().trim().toLowerCase().email().max(254).nullable().optional().transform(v=>v||null),
 principal_name:text(100).nullable().optional().transform(v=>v||null),
 letterhead_text:text(500).nullable().optional().transform(v=>v||null)
}).strict();
export const logoBody=z.object({
 mime:z.enum(['image/png','image/jpeg']),
 data:z.string().max(700000).regex(/^[A-Za-z0-9+/]+={0,2}$/,'base64 data URL payload')
}).strict();
