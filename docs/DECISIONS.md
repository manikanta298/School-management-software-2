# Architectural decisions (D1–D9)

Recorded by: the Batch 2 agent (acting on the owner's behalf under the "suggested default if the owner is silent" rule in `BATCH_1_HANDOFF.md` §6).
Date opened: 2026-11-17.
Status: **active**. The owner may override any of these at any time; an override supersedes the default here and must be recorded as a new dated row.

The defaults below are exactly the ones recommended in `BATCH_1_HANDOFF.md` §6. They are adopted **only because the owner has been silent on each item**; nothing here prevents a later change of mind.

| # | Decision | Resolution adopted | Affects | Rationale |
|---|---|---|---|---|
| D1 | File/image storage (logo, letterhead, homework attachments, staff documents) | Small files (≤512 KiB) stored in PostgreSQL `bytea` with MIME and size checks at the API boundary. No object storage yet. Revisit when any single file exceeds 512 KiB or total binary volume exceeds 1 GiB. | 2.0 logo/letterhead, 3.1 staff documents, 3.3 homework attachments | Keeps the deploy story single-process; matches the existing self-hosted Postgres install. Trivial to migrate to object storage later because all binary blobs live in one column per table. |
| D2 | Late-penalty rules and concession approval | Penalties are flat amounts per invoice, applied by an explicit administrator action (not automatic). Concessions require a second administrator approval when the absolute amount exceeds 5% of the invoice's `amount_minor`; below that threshold the acting administrator can self-approve. The approver is recorded on the row. | 2.1 fees carry-over | Predictable for parents and accountants; avoids surprise charges. The 5% threshold is configurable later via a settings row without a migration. |
| D3 | Aadhaar collection | Not collected. The schema has no Aadhaar column, no UI asks for it, no import column accepts it. If the owner later requires it, store only the masked last-4 digits, never the full number. | 2.8 students carry-over, 4.4 privacy review | Minimises DPDP Act exposure; the system works without it. |
| D4 | Student import credentials | Each imported student gets a generated one-time temporary password (`users.must_change_password=true`); the API returns a single one-time CSV of `admission_number,email,temporary_password` for the administrator to distribute. The CSV is never persisted server-side. | 2.8 student import | Consistent with PR #58's temporary-password flow and §5's "secrets" rule. |
| D5 | Photos for ID cards | ID cards and hall tickets are issued **without photos** in this phase. The endpoints return data-only JSON; the UI prints the card with a placeholder. Photos are deferred until D1's binary storage is revisited. | 2.4 ID cards and hall tickets | No photo pipeline exists yet; a placeholder keeps the feature shippable. |
| D6 | Leave management and payroll scope | Phase 1 includes **student leave** and **staff leave** (separate tables, separate approval queues). **Payroll is deferred to Phase 2.** Parent-portal leave application and teacher–parent messaging are included in Phase 1. | Batch 4 (4.0, 4.1) | Matches the owner's likely intent; payroll needs salary-structure decisions that are out of scope here. |
| D7 | Export libraries | `exceljs` for `.xlsx`, `pdfkit` for server-side `.pdf`, browser `printElement` for printable receipts/cards. CSV stays hand-rolled (existing pattern). | 3.6 reports and exports | `exceljs` and `pdfkit` are widely used, MIT-licensed, and work without an external headless browser. |
| D8 | Privileged-user MFA method | TOTP (RFC 6238) via `speakeasy`/`otplib`-style secret stored encrypted at rest. Enrollment requires a fresh login; backup codes are not generated in this phase. Required for `admin` and `principal` only. | 4.3 security review (6.5) | TOTP is offline, free, and well understood. SMS/email OTP rejected (no transport). |
| D9 | Backup target and retention | Daily `pg_dump` to off-site object storage, 30-day retention, one monthly snapshot kept for 12 months. Restore is tested at least once per quarter. Access restricted to the school's deployment operator. | 4.2 environment readiness, 4.3 (6.3) | Conservative; matches a single-school self-hosted install. Object-storage credentials live in environment variables, never in Git. |

## Change log

| Date | Decision | Change | By |
|---|---|---|---|
| 2026-11-17 | D1–D9 | Initial adoption of the §6 suggested defaults | Batch 2 agent (owner silent) |
