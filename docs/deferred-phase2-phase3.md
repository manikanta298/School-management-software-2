# Deferred to Phase 2 and Phase 3

Owner: school operator. Last reviewed: 2026-11-17 by the Batch 4 agent.

These items are intentionally **not** part of Phases 1–4. They are listed here so they are not forgotten. The owner can promote any of them into a future phase by recording the decision in `docs/DECISIONS.md`.

## Phase 2 candidates

1. **Staff payroll** (D6 explicit deferral). Salary structures, payslips, statutory deductions, pay-period runs. Requires salary-structure decisions that are out of scope of the current code. Tables: `pay_grades`, `pay_components`, `salary_structures`, `payslips`, `payslip_lines`. APIs under `/api/payroll/*`, admin-only.
2. **Photo pipeline for ID cards** (D5). Currently ID cards are issued without photos. A photo pipeline would require: a photo capture/upload UI, a per-student and per-teacher photo store (extend D1's `bytea` approach or move to object storage), and a refresh of the ID card template to include the photo.
3. **Object storage for files** (D1 revisit). The current ≤512 KiB `bytea` approach works for logos, staff documents, and homework attachments, but does not scale for video, audio, or large PDFs. When the total binary volume exceeds 1 GiB or any single file exceeds 512 KiB, migrate to S3/GCS/Azure Blob with a presigned-URL upload flow.
4. **Notification delivery channels** (D7). Currently `notification_preferences` only stores preferences; no delivery channel exists. Phase 2 would add: an in-app notification centre (`GET /api/notifications`, mark-as-read), an email transport (SES/SendGrid/Mailgun), and an SMS transport (Twilio/MSG91).
5. **Backup codes for MFA** (D8). Currently TOTP enrollment does not generate backup codes. Phase 2 would generate 10 one-time backup codes on enrollment, store them hashed, and accept them as a fallback when TOTP is unavailable.
6. **Large-section bulk marking capacity** (3.2). The attendance register bulk path is tested with a small section; Phase 2 should stress-test with sections at the 500-student capacity and add batching if needed.
7. **Marks editing restriction negative tests for principal and other teachers** (3.4). The model-level scope already prevents non-paper teachers from editing marks, but explicit negative tests for principal and other teachers were not added in Phase 1.

## Phase 3 candidates

8. **Alumni portal.** A read-only portal for graduated students to view their historical results, attendance, and certificates. Requires a new role `alumni` and a separate token flow.
9. **Library management.** The `librarian` role currently has view-only access to students/notices/calendar. Phase 3 would add a full library module: catalog, checkouts, reservations, fines, overdue alerts.
10. **Health records.** A per-student health record (vaccinations, allergies, emergency contacts, visits to the school nurse). Restricted to admin and a new `nurse` role.
11. **Inventory and assets.** Track school assets (furniture, equipment, books) with depreciation and assignment to staff/rooms.
12. **Admissions workflow.** A multi-step admission application form with status tracking (submitted → screened → interviewed → offered → enrolled), document uploads, and communication with applicants.
13. **Multi-language UI.** The data layer is locale-agnostic; the UI would need i18n with at least English and one regional language.

## Items the owner must explicitly promote

Any item in this list that the owner wants in Phase 2 or Phase 3 must be recorded as a dated decision in `docs/DECISIONS.md` with a brief rationale and an assigned priority. Without that record, the item stays deferred.
