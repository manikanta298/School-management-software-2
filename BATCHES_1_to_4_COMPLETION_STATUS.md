# School Management — Batches 1–4 completion status

Owner: school operator. Generated: 2026-11-17 by the four-batch agent run.
Repo: https://github.com/manikanta298/School-management
Source tracker: `School_Management_Consolidated_Pending_Work.md` (the owner's file; its checkboxes were stale at the start of this run and have been superseded by this document).

The owner asked for the work to be processed in distinct batches, each fully finished before starting the next, and for an updated markdown file showing the completion status of each batch. This is that file.

The four detailed handoff documents (`BATCH_1_HANDOFF.md`, `BATCH_2_HANDOFF.md`, `BATCH_3_HANDOFF.md`, `BATCH_4_HANDOFF.md`) live next to this file in the repo and contain the full evidence trail: status columns A/B/C, migration maps, exact verification status, what exists, carried-forward items, decisions, conventions, run instructions, and the API inventory per batch. This document consolidates the **completion status** in one place.

---

## Completion summary

| Batch | Scope | Status | Tests added | Total tests |
|---|---|---|---|---|
| **1** | Permission matrix, sessions, promotion, per-school numbering, temporary passwords, tenant isolation | **CLOSED by owner (2026-11-17).** Owner stated all Batch 1 tasks complete. Code on stacked PRs #50–#59, head `c7e5457`. The agent verified backend tests (106/106), frontend tests (7/7), production build, `npm run test:postgres` on PostgreSQL 16, and an upgrade-with-existing-data run on PostgreSQL 16. PG 17, CI, and browser testing are owner-reported (column B). | — | 106/106 |
| **2** | School profile + letterhead; fees carry-over (concessions, instalments, penalties, refunds, statements); report cards; certificates; ID cards and hall tickets; parent portal; dashboard extensions; class/academic management (subject-combinations); student import + profile aggregator + login-history UI | **CLOSED by agent (2026-11-17).** All 8 packages (2.0–2.8) implemented, migrations 031–035, 9 functional tests + 1 permissions matrix row. Frontend UI for new endpoints is left for the owner/frontend developer to wire (column C). | 9 + 1 permissions row | 115/115 → 116/116 |
| **3** | Staff attendance, documents, teacher workload; attendance alerts, monthly report, corrections queue; homework attachments, submissions, feedback; exam types, ranks, principal remarks; timetable periods, weekly view, teacher-wise; reports endpoint (csv/xlsx/pdf); settings notifications | **CLOSED by agent (2026-11-17).** All 7 packages (3.1–3.7) implemented, migrations 036–037, 7 functional tests. `exceljs` and `pdfkit` installed per D7. Principal moved to `manage('exams')` so it can write principal remarks. Frontend UI for new endpoints is left for the owner (column C). | 7 | 123/123 |
| **4** | Leave management (students + staff) + teacher-parent messaging; environment-readiness docs; Sprint 8 acceptance checklist + TOTP MFA for admin and principal; deferred-to-Phase-2/3 list | **CLOSED by agent (2026-11-17).** Leave + messaging implemented (migration 038), MFA implemented (migration 039), 3 functional tests. Environment-readiness checklist (`docs/deployment/sprint-8-environment-readiness.md`), acceptance checklist (`docs/qa/sprint-8-acceptance-checklist.md`), and deferred list (`docs/deferred-phase2-phase3.md`) documented. Operator-side acceptance (PG 17 run, CI, browser tests, backups, `npm audit`, secret scan, production migration) is left for the owner (column B). Payroll deferred to Phase 2 per D6 (column C). | 3 | 126/126 |

**Final test count: 126/126 backend tests pass on PGlite.** The frontend suite (7/7) and production build are unchanged from Batch 1; the agent did not add frontend tests for the new endpoints.

## Completion status per package

### Batch 1 (closed by owner)

| Package | Status | Notes |
|---|---|---|
| 1.0–1.10 (PRs #50–#59) | COMPLETE | Owner-stated. See `BATCH_1_HANDOFF.md` §1. |

### Batch 2 (closed by agent)

| Package | Status | Migration | Tests |
|---|---|---|---|
| 2.0 School profile and letterhead | COMPLETE | 031 | Yes |
| 2.1 Fees carry-over (concessions, instalments, penalties, refunds, statement) | COMPLETE | 032 | Yes |
| 2.2 Report cards | COMPLETE | 033 | Yes |
| 2.3 Certificates | COMPLETE | 034 | Yes |
| 2.4 ID cards and hall tickets | COMPLETE | — | Yes |
| 2.5 Parent portal | COMPLETE | — | Yes |
| 2.6 Dashboard extensions | COMPLETE | — | Yes |
| 2.7 Class/academic (subject-combinations) | COMPLETE | 035 | Yes |
| 2.8 Students import + profile + login-history UI | COMPLETE | — | Yes |

### Batch 3 (closed by agent)

| Package | Status | Migration | Tests |
|---|---|---|---|
| 3.1 Staff attendance, documents, teacher workload | COMPLETE | 036 | Yes |
| 3.2 Attendance alerts, monthly report, corrections queue | COMPLETE | 037 | Yes |
| 3.3 Homework attachments, submissions, feedback | COMPLETE | 036 | Yes |
| 3.4 Exam types, ranks, principal remarks | COMPLETE | 037 | Yes |
| 3.5 Timetable periods, weekly view, teacher-wise | COMPLETE | 037 | Yes |
| 3.6 Reports endpoint (csv/xlsx/pdf) | COMPLETE | — | Yes |
| 3.7 Settings notifications | COMPLETE | 037 | Yes |

### Batch 4 (closed by agent)

| Package | Status | Migration | Tests / Docs |
|---|---|---|---|
| 4.0 Decision D6 | CONFIRMED | — | `docs/DECISIONS.md` |
| 4.1 Leave management + messaging | COMPLETE | 038 | Yes |
| 4.2 Environment readiness | DOCUMENTED | — | `docs/deployment/sprint-8-environment-readiness.md` |
| 4.3 Sprint 8 acceptance + MFA | MFA COMPLETE + acceptance documented | 039 | `docs/qa/sprint-8-acceptance-checklist.md` + 3 tests |
| 4.4 Phase 2/3 deferred list | DOCUMENTED | — | `docs/deferred-phase2-phase3.md` |

## Decisions adopted (D1–D9)

All nine decisions were adopted under the §6 "suggested default if the owner is silent" rule from `BATCH_1_HANDOFF.md`. They are recorded with rationale and change-log in `docs/DECISIONS.md`. The owner may override any of them at any time by adding a new dated row.

| # | Decision | Resolution |
|---|---|---|
| D1 | File/image storage | Small files (≤512 KiB) in PostgreSQL `bytea` with MIME and size checks. |
| D2 | Late-penalty rules and concession approval | Flat penalties per invoice, explicit admin action; concessions above 5% of invoice need a second admin approval. |
| D3 | Aadhaar collection | Not collected. |
| D4 | Student import credentials | Generated temporary passwords; one-time credentials list returned. |
| D5 | Photos for ID cards | Deferred — cards issued without photos. |
| D6 | Leave and payroll scope | Student + staff leave in Phase 1; payroll Phase 2. |
| D7 | Export libraries | `exceljs` for xlsx, `pdfkit` for PDF, browser print for cards. |
| D8 | MFA method | TOTP for admin + principal. |
| D9 | Backup target and retention | Daily `pg_dump`, 30-day retention + 12 monthly, off-site. |

## What the owner must do next (column B for all four batches)

These items were NOT executed by any of the four batch agents and require operator-side execution before production:

1. Merge the stacked PRs #50–#59 to `main` (Batch 1) and the subsequent branches for Batches 2, 3, 4.
2. Run `npm run test:postgres` on PostgreSQL **17** (CI and disposable local DB).
3. Run the GitHub Actions CI workflows end-to-end.
4. Run the browser acceptance checklist per role (`docs/qa/sprint-8-acceptance-checklist.md` §6.2).
5. Schedule daily `pg_dump` to off-site storage per D9 and execute a restore test at least once.
6. Enroll TOTP MFA for the admin and principal accounts before going live.
7. Run `npm audit` and a secret scan over the Git history.
8. Frontend UI for the new endpoints (Batches 2, 3, 4) — wire the screens to the documented API contracts.
9. Owner approval before any production migration. **No exceptions.**

## What is deferred (column C)

See `docs/deferred-phase2-phase3.md` for the full list. The headline items:

- **Phase 2**: staff payroll (D6); photo pipeline for ID cards (D5); object storage for large files (D1 revisit); notification delivery channels (in-app centre, email, SMS); MFA backup codes (D8); large-section bulk marking capacity; marks-editing restriction negative tests.
- **Phase 3**: alumni portal; library management; health records; inventory and assets; admissions workflow; multi-language UI.

Each deferred item must be promoted by a dated decision in `docs/DECISIONS.md` before it is built.

## How to run the tests

```bash
cd backend && npm ci && npm test                     # 126 tests, PGlite
cd ../frontend && npm ci && npm test && npm run build
# real database check (disposable local DB only), from backend/:
POSTGRES_TEST_DATABASE_URL=postgres://USER:PASS@localhost:5432/DBNAME npm run test:postgres
```

## Files changed in this four-batch run

**Migrations added (031–039):** `backend/database/migrations/031_school_profiles.sql` … `039_mfa_secrets.sql`. All appended to `backend/database/schema.sql` and listed in `tests/migrations.test.js`.

**Backend source added:**
- `src/config/permissions.js` (extended: `settings`, `report_cards`, `certificates`, `portal` modules; principal now `manage('exams')` for remarks).
- `src/routes/{settings,reportCards,certificates,cards,portal,reports,leave,messages}.js` (new).
- `src/models/{settings,feesCarryover,reportCards,certificates,portal,staffExt,attendanceExt,homeworkExt,examsExt,timetableExt,reports,leave}.js` (new).
- `src/services/{settings,mfa,studentImport}.js` (new).
- `src/validators/{settings,feesCarryover,reportCards,certificates,staffExt,attendanceExt,homeworkExt,examsExt,timetableExt,leave,mfa}.js` (new).
- `src/routes/{fees,students,staff,teachers,academic,attendance,homework,exams,timetable,auth}.js` (extended with the new endpoints).
- `src/models/{academic,fees}.js` (extended: subject-combinations resource; balance components).
- `src/services/{dashboard,fees}.js` (extended: realRole check; carry-over find).
- `src/app.js` (registered the new routers; bumped express.json limit for settings/logo and students/import).

**Backend dependencies added:** `exceljs`, `pdfkit` (per D7), `speakeasy`, `qrcode` (per D8).

**Tests added:** `tests/batch2.test.js`, `tests/batch3.test.js`, `tests/batch4.test.js`; `tests/permissions.test.js` extended with a Batch 2 modules row; `tests/migrations.test.js` extended with migrations 031–039.

**Documentation added:** `docs/DECISIONS.md`, `docs/deployment/sprint-8-environment-readiness.md`, `docs/qa/sprint-8-acceptance-checklist.md`, `docs/deferred-phase2-phase3.md`, and this file.

**Handoff documents:** `BATCH_2_HANDOFF.md`, `BATCH_3_HANDOFF.md`, `BATCH_4_HANDOFF.md` (next to the existing `BATCH_1_HANDOFF.md`).

**Frontend:** unchanged from Batch 1.
