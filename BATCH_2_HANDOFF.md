# School Management — Handoff after Batch 2, and roadmap for Batches 3 and 4

Written by: the Batch 2 agent · Repo: https://github.com/manikanta298/School-management
Source tracker: `School_Management_Consolidated_Pending_Work.md` (the owner's file; its checkboxes are stale — see section 3).
Parent handoff: `BATCH_1_HANDOFF.md`. Architectural decisions adopted under the §6 defaults (owner silent) live in `docs/DECISIONS.md`.

---

## 1. Status of Batch 2

**Batch 2 is CLOSED by the Batch 2 agent (2026-11-17): all eight packages (2.0–2.8) have been implemented, tested at 116/116 backend tests green, and their cross-school negative + permission-matrix rows added.**

| Column | Meaning | Items |
|---|---|---|
| **A. Built and tested by the Batch 2 agent** | Code exists on this branch with automated tests | Section 4 — packages 2.0 through 2.8 |
| **B. Owner-reported, not verified by the agent** | The agent had no way to run these | Real PostgreSQL 17 run, GitHub CI, browser/Playwright testing of new screens, deployment, frontend component tests beyond the existing 7 |
| **C. Carried forward (NOT built)** | Deferred to Batch 3 or later | UI for new screens is minimal (data-only endpoints ship, the UI shell is left for the owner/frontend dev to wire); leave applications and teacher messaging deferred to Batch 4 per D6; payroll deferred to Phase 2; Phase 2/3 tracker items untouched |

**First action for the Batch 3 agent:** start from the code in this snapshot (or the equivalent merged branch). Re-run `cd backend && npm test` and confirm 116/116 before any new code. Read `docs/DECISIONS.md` — every D1–D9 default is active and gates the work below.

## 2. Branch and migration map (in order)

| Migration | Branch concept | Contents |
|---|---|---|
| 031 | `feat/school-profiles` | `school_profiles` table (display_name, address, phone, email, principal_name, letterhead_text, logo_bytea ≤512 KiB per D1); logo MIME/size guards |
| 032 | `feat/fees-carryover` | `fee_concessions`, `fee_instalments`, `fee_penalties`, `fee_refunds`; `school_counters` extended to `refund`; `guard_fee_payment` rewritten to balance = amount − concessions − payments + penalties − refunds; new guards `guard_fee_concession` and `guard_fee_refund`; `fee_events` kinds extended (concession_recorded/voided, penalty_applied, refund_issued) |
| 033 | `feat/report-cards` | `report_card_remarks` table (per student/year/term, unique) |
| 034 | `feat/certificates` | `certificates_issued` table; `school_counters` extended to `certificate`; `assign_certificate_number` trigger |
| 035 | `feat/subject-combinations` | `class_subject_combinations` link table with same-school guard trigger |

Each migration is also appended to `backend/database/schema.sql` and listed in `tests/migrations.test.js`.

## 3. Verification status (exact, as of this snapshot)

| Check | Result |
|---|---|
| Backend tests (`cd backend && npm test`, PGlite) | **116/116 pass** (106 pre-existing + 9 Batch 2 + 1 new permissions row). Includes 2.0–2.8 functional + cross-school negative + permissions matrix rows. |
| Frontend tests / production build | Not run by the agent (B above). The frontend code in the snapshot is unchanged from Batch 1; new endpoints have no UI yet. |
| `npm run test:postgres` on PostgreSQL 16.x | Not run by the agent (B above). The new migrations only use standard Postgres features (CHECK, triggers, `next_school_number`, `bytea`); they should pass on real PG but the agent did not execute it. |
| PostgreSQL 17, GitHub CI, browser testing | Not run (B above). |
| D1–D9 decisions | All adopted under the §6 defaults; recorded in `docs/DECISIONS.md` with rationale. |

## 4. What exists (column A)

### 2.0 School profile and letterhead
- `GET /api/settings/school` (any staff with view), `PUT /api/settings/school` (admin), `PUT /api/settings/school/logo` (admin, ≤512 KiB PNG/JPEG), `GET /api/settings/school/logo`, `GET /api/settings/permissions` (returns the acting user's matrix).
- New module `settings` in the matrix: admin manage, principal view.
- Tests: admin writes, principal reads, accountant blocked, school B sees nothing, MIME/size rejected, permissions endpoint returns the right matrix.

### 2.1 Fees carry-over
- New tables: `fee_concessions`, `fee_instalments`, `fee_penalties`, `fee_refunds`. The invoice row stays immutable.
- New APIs: `GET/POST /api/fees/invoices/:id/concessions`, `POST .../concessions/:cid/void`, `GET/PUT /api/fees/invoices/:id/instalments`, `GET/POST /api/fees/invoices/:id/penalties`, `GET /api/fees/invoices/:id/refunds`, `POST /api/fees/invoices/:id/payments/:paymentId/refund`, `GET /api/fees/students/:studentId/statement`.
- `fee_events` extended with `concession_recorded`, `concession_voided`, `penalty_applied`, `refund_issued` kinds and new `concession_id`, `penalty_id`, `refund_id` columns.
- The `guard_fee_payment` trigger now rejects overpayments against `amount − concessions − payments + penalties − refunds`; `guard_fee_concession` blocks concessions that exceed outstanding; `guard_fee_refund` blocks refunds exceeding the parent payment's reversible amount.
- Refund numbers are per-school gap-free via `next_school_number(school,'refund')`.
- Tests: full concession→payment→penalty→instalment→refund→statement cycle; over-concession and overpayment rejected; cross-school 404; parent scope.

### 2.2 Report cards
- `GET /api/report-cards?academic_year_id=&section_id=`, `GET /api/report-cards/:studentId?academic_year_id=`, `PUT /api/report-cards/:studentId/remarks`.
- Reuses existing `exams`/`exam_papers`/`exam_marks` (only published exams), `attendance_entries`, `report_card_remarks` (new).
- Scoping: admin school-wide; teacher (sections they teach); parent (linked children); student (self).
- New module `report_cards` in the matrix: principal view, receptionist view (read-only).
- Tests: principal/receptionist view, accountant blocked, teacher remark upsert, parent reads own child only, cross-school 404.

### 2.3 Certificates
- `POST /api/certificates`, `GET /api/certificates?student_id=&type=`, `GET /api/certificates/:id`, `POST /api/certificates/:id/void`.
- Per-school gap-free certificate number via `next_school_number(school,'certificate')`.
- Issue captures a JSONB snapshot of the student + school profile at issue time; void records reason + actor; reissue creates a new row with a new number.
- New module `certificates` in the matrix: principal **manage**, admin manage.
- Tests: principal/admin issue and void, per-school numbering monotonic and distinct, cross-school blocked, accountant blocked.

### 2.4 ID cards and hall tickets
- `GET /api/cards/students/:studentId/id-card`, `GET /api/cards/teachers/:teacherId/id-card`, `GET /api/cards/exams/:examId/hall-tickets?section_id=`.
- Data-only endpoints; printing is left to the UI. Per D5, no photos are included.
- Scoping: admin/teacher school-wide; student/parent only own/linked.
- Tests: admin/parent/student/teacher access matrix, cross-school 404, invalid UUID 400.

### 2.5 Parent portal
- `GET /api/portal/children`, `GET /api/portal/children/:studentId/overview`.
- Aggregates: outstanding balance (with concessions/penalties/refunds), 30-day attendance %, unread notices (via the existing `notices.unread`), pending homework, next exam.
- Same `POST /api/auth/login` flow; parent role lands on the portal.
- Negative tests: parent cannot see non-linked child (403), other roles blocked (403).
- Leave applications and teacher communication deferred to Batch 4 per D6.

### 2.6 Dashboard extensions
- The existing `GET /api/dashboard` already includes today's timetable, monthly collection trend, recent admissions, upcoming birthdays — no API change needed.
- Fixed: `services/dashboard.js` now compares `actor.role` against `user.realRole || user.role` so converted staff roles (principal view on dashboard) pass the auth re-check instead of returning 401.
- Non-principal staff roles (accountant/receptionist/librarian/transport_manager) still get 403 from `moduleAccess('dashboard')`.
- Tests: principal gets 200 with full admin-equivalent payload, accountant 403, school B admin 200.

### 2.7 Class and academic management
- New academic resource `subject-combinations` exposed at `GET/POST/PUT/DELETE /api/academic/subject-combinations` (and `?class_id=`).
- New table `class_subject_combinations` with a same-school guard trigger that rejects class_id/subject_id from different schools (23514 → 400).
- `models/academic.js` resources map gained an `order` field so each resource can sort by its own columns.
- Class teachers and class capacity are unchanged (the handoff said "verify and test" — the existing teacher assignments with `kind='class_teacher'` already exist; sections already have `capacity`).
- Tests: same-school create succeeds, cross-school subject reference rejected, cross-school write rejected (400 or 403).

### 2.8 Students carry-over
- `POST /api/students/import` (dry_run default; all-or-nothing; creates users with `must_change_password=true`; returns a one-time `credentials` list per D4).
- `GET /api/students/:id/profile` aggregates: student + parents + enrollments + attendance summary + fees + homework + transport.
- Aadhaar is **not** collected anywhere (per D3).
- Login-history admin UI endpoint already exists from Batch 1 (`GET /api/auth/admin/users/:userId/login-history`).
- Tests: dry-run validation, duplicate detection, real insert issues credentials + forces password change, re-import fails, profile aggregator returns the right shape, accountant blocked from import.

### Frontend
- The frontend in this snapshot is unchanged. The new endpoints are reachable from the existing UI only via direct API calls; **the UI for school profile, fees carry-over, report cards, certificates, ID cards, parent portal, student import, and profile tabs is left for the owner/frontend developer to wire**. The data contracts are stable.

## 5. Conventions every later agent MUST follow (carried from Batch 1, unchanged)

- **Minimal-touch changes:** change only what is necessary; preserve UI, styling and structure.
- **Tenant scoping:** filter every tenant-table query by `school_id` (`req.schoolId`; `req.user.schoolId`); write `school_id` explicitly on inserts.
- **Every new endpoint needs a cross-school negative test**, and every new module needs a row in `tests/permissions.test.js`.
- **Migrations:** add `backend/database/migrations/NNN_name.sql`, append the same SQL to `backend/database/schema.sql`, and add the filename to the list in `tests/migrations.test.js`. **Next number: `036`.**
- **New module for staff roles:** add it to `MODULES`/`MATRIX` in `config/permissions.js`, add `moduleAccess('<module>')` after `authenticate` in its router, add tests.
- **Numbering:** never write invoice/receipt/certificate/refund numbers by hand; use `next_school_number(school_id, name)` inside the inserting transaction.
- **Secrets:** never commit or print tokens/passwords. Temporary passwords appear only once in the API response.
- **When `moduleAccess` converts a staff role to admin** (default behaviour), the underlying service re-check must compare `actor.role !== (user.realRole || user.role)`, not `actor.role !== user.role`. See `services/dashboard.js` for the pattern.
- **Pre-populated `values` arrays in model scope functions:** if you pre-fill `values` before calling a scope helper, the scope helper must track positions explicitly (push schoolId → record its position; push user.id → record its position) rather than using `values.length` for both. See `models/reportCards.js` `studentScope` for the pattern.

## 6. Owner decisions that still gate later work (carry-forward from Batch 1 §6)

D1–D9 are all adopted under the §6 defaults and recorded in `docs/DECISIONS.md`. The owner may override any of them; an override supersedes the default and must be recorded as a new dated row.

| # | Decision | Affects |
|---|---|---|
| D1 | Small files in PostgreSQL `bytea` ≤512 KiB | 2.0 logo, 3.1 staff documents, 3.3 homework attachments |
| D2 | Penalties flat per invoice, concessions need approval >5% | 2.1 (done), 3.6 reports |
| D3 | Aadhaar not collected | 2.8 (done), 4.4 privacy review |
| D4 | Import generates temporary passwords, one-time CSV | 2.8 (done) |
| D5 | ID cards without photos | 2.4 (done) |
| D6 | Student + staff leave in Phase 1; payroll Phase 2 | Batch 4 (4.0, 4.1) |
| D7 | `exceljs` for xlsx, `pdfkit` for PDF, browser print for cards | 3.6 reports |
| D8 | TOTP MFA for admin + principal | 4.3 security (6.5) |
| D9 | Daily `pg_dump`, 30-day retention, off-site | 4.2 environment, 4.3 (6.3) |

---

# ROADMAP (Batches 3 and 4 — copied from `BATCH_1_HANDOFF.md`, unchanged unless noted)

## BATCH 3 — Operations, reports and settings (~50 tasks, 7 packages)

Next migration number: **036**. Each package ends with: tests (incl. cross-school negative and permissions rows), stacked PR, notes in the Batch 3 handoff.

**3.1 Teacher and staff management** (5.6). Existing: `GET/POST/PUT/DELETE /api/staff`, `/api/staff/:id`, `/api/teachers` + assignments.
- New: staff attendance `GET/PUT /api/staff/attendance`, workload `GET /api/teachers/:id/workload` (assignments + weekly periods from `GET /api/timetable/slots`), staff documents (needs D1) `POST/GET /api/staff/:id/documents`. Access: principal and transport_manager view; never expose pay data beyond admin.

**3.2 Attendance enhancements** (5.8). Existing: `GET /api/attendance/calendar|sections|register|summary|audit|students/:id`, `PUT /api/attendance/register`.
- New: low-attendance alerts `GET /api/attendance/alerts?threshold=&from=&to=`, monthly report `GET /api/attendance/reports/monthly?section_id=&month=`, correction approval flow (`POST /api/attendance/corrections`, `POST /api/attendance/corrections/:id/approve|reject`) using the existing audit history; bulk marking via the existing register (verify the bulk path and add tests for capacity of large sections).

**3.3 Homework enhancements** (5.9). Existing: `GET/POST /api/homework`, `/:id`, `/:id/archive`, `/:id/complete`.
- New (needs D1): attachments `POST /api/homework/:id/attachments`, `GET /api/homework/:id/attachments/:aid`; submissions `POST /api/homework/:id/submissions`, `GET /api/homework/:id/submissions`; feedback `PUT /api/homework/:id/submissions/:studentId/feedback`. Strict MIME (PDF/JPEG/PNG) and size checks; visibility = same rules as homework.

**3.4 Exams enhancements** (5.10). Existing: exams, papers, candidates, marks, `publish|reopen|cancel`, `grading-scales`, `audit`.
- New: exam types `GET/POST /api/exams/types`, optional class rank `GET /api/exams/:id/ranks`, principal remarks `PUT /api/exams/:id/students/:studentId/remarks`, marks editing restricted to the paper's teacher or admin (already scoped; add negative tests for principal and other teachers).

**3.5 Timetable enhancements** (5.11). Existing: `GET /api/timetable/calendar|assignments|rooms|slots`, `POST/PUT` slots, `POST /slots/:id/deactivate`, `GET /slots/:id/audit`.
- New: periods and breaks `GET/PUT /api/timetable/periods`, weekly view `GET /api/timetable/week?section_id=`, teacher-wise `GET /api/timetable/teachers/:teacherId`. Verify conflict prevention with explicit concurrency tests.

**3.6 Reports and exports** (5.12). Existing: `GET /api/students/export.csv`, `GET /api/fees/reports/collection`, `/defaulters`, `GET /api/attendance/summary`.
- New common endpoint `GET /api/reports/:name?format=csv|xlsx|pdf&academic_year_id=&from=&to=&class_id=&section_id=` for students, attendance, fees-collection, defaulters, exam-results (needs D7). Role permissions and active-school scope enforced in the query, not the UI; test that exports never include another school's rows.

**3.7 Settings** (5.13 remainder). Needs 2.0.
- `GET/PUT /api/settings/academic-years` (reuse `/api/academic/academic-years`), `GET /api/settings/permissions` (already built in Batch 2), fee configuration screen over `/api/fees/structures`, `GET/PUT /api/settings/notifications` (preferences only; no delivery channel exists), backup/restore documentation in `docs/`. Settings isolated per school (negative tests).

## BATCH 4 — Scope decision, acceptance and release (~30 tasks, 6 packages)

**4.0** Record decision D6 in `docs/DECISIONS.md` (already recorded by Batch 2; Batch 4 only confirms).

**4.1** Leave management (only if D6 says yes — it does). Tables `leave_requests` (student or staff), `leave_balances` (staff). APIs: `POST/GET /api/leave/students`, `POST /api/leave/students/:id/approve|reject`, `POST/GET /api/leave/staff`, same for approval. Include parent-portal leave application and teacher communication (`POST/GET /api/messages`, scoped to teacher–parent pairs of linked children). Payroll is Phase 2.

**4.2** Environment readiness: verify `backend/.env.example` and `backend/production.env.example`, document PostgreSQL variables, SSL, pool/timeouts, migration command and order, separate test database config, guard against pointing tests at production, Docker Compose health checks and volumes, PostgreSQL 17 in CI, backup/restore commands.

**4.3** Sprint 8 acceptance and readiness (tracker section 6): 6.1 full backend suite + `npm run test:postgres` on PG 17; 6.2 browser acceptance per role; 6.3 daily backups + restore test + DR doc; 6.4 audit log review + DPDP Act review + Aadhaar review (D3 — already not collected); 6.5 HTTPS + rate limiting review + validation + XSS/SQLi review + authz review + session/password-reset review + **TOTP MFA for admin + principal** (D8 — `POST /api/auth/mfa/enroll|verify`) + `npm audit` + secret scan over history; 6.6 load test; 6.7 production migration plan + rollback plan + owner approval.

**4.4** Phase 2 and Phase 3 (deferred, 13 tracker items): not part of Phases 1–4 unless the owner promotes them.

## Handoff files (REQUIRED)

- When **Batch 3** is finished, the Batch 3 agent **must generate `BATCH_3_HANDOFF.md`** with this document's structure: status with columns A/B/C, migration map in order, exact verification status, what exists, carried-forward items, decisions, conventions, run instructions, and the **exact APIs to link for Batch 4**. It must end by instructing the Batch 4 agent to generate `BATCH_4_HANDOFF.md`.
- The **Batch 4** agent must generate `BATCH_4_HANDOFF.md` (final) containing the acceptance results, defect log, deployment/rollback status, and a "what is deferred" list.
- Every handoff must say plainly what was **not** run or verified.

## Run it

```bash
cd backend && npm ci && npm test                     # 116 tests, PGlite
cd ../frontend && npm ci && npm test && npm run build
# real database check (disposable local DB only), from backend/:
POSTGRES_TEST_DATABASE_URL=postgres://USER:PASS@localhost:5432/DBNAME npm run test:postgres
```

---

## Appendix A — New API routes added in Batch 2

Prefix `/api`. All routes require authentication; roles are enforced per router.

### /api/settings (4)
```
GET  /api/settings/school
PUT  /api/settings/school
PUT  /api/settings/school/logo
GET  /api/settings/school/logo
GET  /api/settings/permissions
```

### /api/fees (additions; existing routes unchanged)
```
GET    /api/fees/invoices/:id/concessions
POST   /api/fees/invoices/:id/concessions
POST   /api/fees/invoices/:id/concessions/:cid/void
GET    /api/fees/invoices/:id/instalments
PUT    /api/fees/invoices/:id/instalments
GET    /api/fees/invoices/:id/penalties
POST   /api/fees/invoices/:id/penalties
GET    /api/fees/invoices/:id/refunds
POST   /api/fees/invoices/:id/payments/:paymentId/refund
GET    /api/fees/students/:studentId/statement
```

### /api/report-cards (3)
```
GET  /api/report-cards
GET  /api/report-cards/:studentId
PUT  /api/report-cards/:studentId/remarks
```

### /api/certificates (4)
```
GET   /api/certificates
POST  /api/certificates
GET   /api/certificates/:id
POST  /api/certificates/:id/void
```

### /api/cards (3)
```
GET  /api/cards/students/:studentId/id-card
GET  /api/cards/teachers/:teacherId/id-card
GET  /api/cards/exams/:examId/hall-tickets
```

### /api/portal (2)
```
GET  /api/portal/children
GET  /api/portal/children/:studentId/overview
```

### /api/students (additions)
```
POST  /api/students/import
GET   /api/students/:id/profile
```

### /api/academic (additions; existing routes unchanged)
```
GET/POST/PUT/DELETE  /api/academic/subject-combinations
```
