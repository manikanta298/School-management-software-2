# School Management — Handoff after Batch 1, and roadmap for Batches 2, 3 and 4

Written by: Claude (batch 1 agent) · Repo: https://github.com/manikanta298/School-management
Code snapshot in the zip: commit `c7e5457`, branch `feat/permission-matrix` (head of the stacked PR chain #50 → #59)
Source tracker: `School_Management_Consolidated_Pending_Work.md` (the owner's file; its checkboxes are **stale**, see section 3)

---

## 1. Status of Batch 1

**Batch 1 is CLOSED by the owner's decision (2026-11-17): the owner states that all Batch 1 tasks and features are complete.**
This file records that decision. It does not claim more than the evidence supports, so the next agent must read the three columns below and must not assume the second and third columns are verified.

| Column | Meaning | Items |
|---|---|---|
| **A. Built and tested by the Batch 1 agent** | Code exists in PRs #50–#59 with automated tests | Everything in section 4 |
| **B. Owner-reported, not verified by the agent** | The agent had no way to run these | Merging PRs #50–#59 to `main`, CI results, PostgreSQL 17 run, browser testing of new screens, revoking the GitHub token |
| **C. Carried forward (NOT built)** | The owner closed Batch 1 without these; they are scheduled below so nothing is lost | Fees: concessions/discounts, instalments, late penalties, refunds. Students: spreadsheet import, profile tabs, optional Aadhaar. Admin screen for a user's login history (API exists). Hiding write controls for read-only roles (they currently get a banner and a 403) |

**First action for the next agent:** run `git fetch && git log --oneline origin/main | head -20` and `gh pr list`/GitHub to confirm which of #50–#59 are actually merged. If they are not merged, work on top of branch `feat/permission-matrix` (head `c7e5457`) or the zip. Never assume column B was done.

## 2. Branch and PR map (stacked; merge in this order)

| Order | PR | Branch | Contents |
|---|---|---|---|
| 1 | #50 | `fix/backend-tests-tenant-audit` | Fixed 6 failing backend tests; migration 026; tenant isolation for homework, dashboard, notices, timetable/rooms/assignments; `tenant-isolation.test.js` |
| 2 | #51 | `feat/school-switching` | `GET /api/auth/schools`, `POST /api/auth/switch-school`; school selector |
| 3 | #52 | `feat/session-security` | Migration 027; sessions list/revoke, logout-all, login history; Security page |
| 4 | #53 | `feat/student-promotion` | `POST /api/students/promote`; promotion screen |
| 5 | #54 | `test/postgres-fee-race` | Fee-payment concurrency check in `npm run test:postgres` |
| 6 | #55 | `feat/fee-receipt` | Receipt endpoint + printable receipt UI |
| 7 | #56 | `feat/admin-session-tools` | Admin force sign-out + per-user login history (API) |
| 8 | #57 | `feat/per-school-numbering` | Migration 028: per-school gap-free invoice/receipt numbers |
| 9 | #58 | `feat/temporary-password` | Migration 029: temporary passwords, forced change |
| 10 | #59 | `feat/permission-matrix` | Migration 030: 5 staff roles + permission matrix; Force sign-out button |

Each PR is stacked on the previous one; retarget the next PR's base to `main` after each merge.

## 3. Verification status (exact, as of `c7e5457`)

| Check | Result |
|---|---|
| Backend tests (`cd backend && npm test`, PGlite) | 106/106 pass |
| Frontend tests / production build | 7/7 pass / builds |
| `npm run test:postgres` on PostgreSQL **16.x** | passes: transport seat race; fee-payment race with gap-free receipt assertion; migrations 001–030 apply to an empty schema |
| Upgrade with existing data on PostgreSQL 16 | passes (migration 028 keeps old numbers, seeds per-school counters) |
| PostgreSQL **17**, GitHub CI, browser testing | **Not run by the agent** (owner-reported, see column B) |

## 4. What exists (column A)

- **Tenant isolation:** no row-level security; every query filters by `school_id`. Cross-school negative tests exist for students, teachers, staff, academic, transport, homework, dashboard, notices, timetable, fees, sessions, permissions.
- **School switching** (`/api/auth/schools`, `/api/auth/switch-school`) with immediate revocation of the old session.
- **Account security:** sessions list/revoke, logout-all, login history, admin force sign-out and per-user login history, **admin-issued one-time temporary passwords** (`POST /api/users/:id/temporary-password`, forced change while `users.must_change_password`).
- **Fees:** per-school gap-free invoice/receipt numbers (migration 028, `school_counters`, `next_school_number()`), printable receipts, concurrency-safe payments (invoice row lock; verified on PostgreSQL).
- **Students:** bulk promotion with dry run (`POST /api/students/promote`) and UI; export, bulk update, status history, enrollment transfers (existing).
- **Roles:** `admin, principal, accountant, receptionist, librarian, transport_manager, teacher, student, parent`. Matrix in `backend/src/config/permissions.js`; `moduleAccess()` middleware in `backend/src/middleware/permissions.js` on 13 routers.

| Role | View | Manage |
|---|---|---|
| principal | academic, students, parents, teachers, staff, attendance, fees, exams, timetable, homework, transport, dashboard | notices, calendar |
| accountant | students, parents, notices, calendar | fees |
| receptionist | timetable, notices, calendar | students, parents (not delete, status change, promote, bulk-update, export: administrator-only) |
| librarian | students, notices, calendar | none |
| transport_manager | students, staff, notices, calendar | transport |

## 5. Conventions every later agent MUST follow

- **Minimal-touch changes:** change only what is necessary; preserve UI, styling and structure.
- **Tenant scoping:** filter every tenant-table query by `school_id` (`req.schoolId`; `req.user.schoolId`); write `school_id` explicitly on inserts (tests hide omissions via column defaults; production does not).
- **Every new endpoint needs a cross-school negative test**, and every new module needs a row in `tests/permissions.test.js`.
- **Migrations:** add `backend/database/migrations/NNN_name.sql`, append the same SQL to `backend/database/schema.sql`, and add the filename to the list in `tests/migrations.test.js`. **Next number: `031`.** Test on real PostgreSQL (`npm run test:postgres`) and, for data-bearing changes, with an upgrade test on existing rows.
- **New module for staff roles:** add it to `MODULES`/`MATRIX` in `config/permissions.js`, add `moduleAccess('<module>')` after `authenticate` in its router, add tests. Keep destructive actions administrator-only (`adminOnly`). In services that verify the acting user, compare with `user.realRole||'admin'` and use the **school membership role**, never the global `users.role`.
- **Numbering:** never write invoice/receipt/certificate numbers by hand; use `next_school_number(school_id, name)` inside the inserting transaction (extend the `school_counters.name` CHECK for new series).
- **Secrets:** never commit or print tokens/passwords. Temporary passwords appear only once in the API response.
- **Workflow per package:** branch from the latest stacked branch (or `main` once merged) → tests alongside code → full `npm test` (backend) + `npm test` and `npm run build` (frontend) → commit → stacked PR → **never merge**; the owner merges.
- **Fixture gotchas:** emails lowercase; admission numbers `^[A-Z0-9_-]{1,30}$`; invoice `issued_on` ≥ enrollment `enrolled_on`; one enrollment per student per academic year; seat capacity is a DB trigger; created notices are drafts until published; `GET/POST /api/students` and `/api/parents` CRUD routes are registered in a loop so they are missing from the regex-built inventory below.
- **Honesty:** state exactly what was and was not run. Do not tick tracker boxes or claim a task done unless it is implemented and tested.

## 6. Owner decisions that gate later work

| # | Decision | Gates | Suggested default if the owner is silent |
|---|---|---|---|
| D1 | File/image storage (logo, letterhead, homework attachments, staff documents) | 2.0, 3.3, 3.1 | Small files (≤512 KB) in PostgreSQL `bytea` with size and MIME checks; revisit for large files |
| D2 | Late-penalty rules and concession approval (principal approves?) | 2.1 | Flat or percentage per structure, applied by an explicit action; concessions need `principal` approval above a configurable amount |
| D3 | Aadhaar: collect at all? masked vs encrypted | 2.8, 4.4 (privacy) | Do not collect; if required, store masked last-4 only |
| D4 | Student import credentials | 2.8 | Generate temporary passwords; return a one-time CSV |
| D5 | Photos for ID cards | 2.4 | Issue cards without photos first |
| D6 | Leave management and payroll scope (tracker 5.14) | Batch 4 | Student leave + staff leave in Phase 1; payroll deferred to Phase 2 |
| D7 | Export libraries (xlsx, pdf) | 3.6 | `exceljs` and `pdfkit`, or browser print for PDF |
| D8 | Privileged-user MFA method | 4.3 | TOTP |
| D9 | Backup target and retention | 4.3 | Daily `pg_dump`, 30-day retention, off-site object storage |

Record every decision in `docs/DECISIONS.md` (create it) with date and who decided.

---

# ROADMAP

Order: **Batch 2 → Batch 3 → Batch 4.** Package ids below are `batch.package`. Each package ends with: tests (incl. cross-school negative and permissions rows), stacked PR, notes in the batch handoff.

## BATCH 2 — Documents, families and the dashboard (~50 tasks, 8 packages)

**2.0 School profile and letterhead** (tracker 5.13 school profile; 5.3 letterhead). Prerequisite for 2.2–2.4.
- New table `school_profiles` (unique `school_id`: display name, address, phone, email, principal name, logo data per D1). Migration `031`.
- New APIs: `GET /api/settings/school` (any member), `PUT /api/settings/school` (admin). Add module `settings` to the matrix (admin manage, principal view).
- Link: extend `GET /api/fees/invoices/:id/payments/:paymentId/receipt` to include the profile; receipt UI shows logo/address.
- Tests: isolation per school; MIME/size rejection; principal read-only.

**2.1 Fees carry-over** (from Batch 1 column C; also needed for parent fee statements). Needs D2.
- Rule: `fee_invoices` rows are snapshot-protected by triggers; do **not** edit `amount_minor`. Add separate tables: `fee_concessions` (invoice_id, amount_minor, reason, approved_by, voided_at), `fee_instalments` (invoice_id, due_on, amount_minor), `fee_penalties` (invoice_id, rule, amount_minor, applied_on), `fee_refunds` (payment_id, amount_minor, reason). Balance = invoice − concessions − payments + penalties + refunds, enforced by triggers like the payment guard (lock the invoice row).
- Existing APIs to link: `GET/POST /api/fees/invoices`, `GET /api/fees/invoices/:id`, `POST /api/fees/invoices/:id/payments`, `POST .../payments/:paymentId/reverse`, `POST /api/fees/invoices/:id/void`, `GET /api/fees/invoices/:id/events`, `GET /api/fees/summary`, `GET /api/fees/reports/collection|defaulters`.
- New APIs: `POST /api/fees/invoices/:id/concessions`, `POST /api/fees/invoices/:id/concessions/:cid/void`, `PUT /api/fees/invoices/:id/instalments`, `POST /api/fees/invoices/:id/penalties`, `POST /api/fees/invoices/:id/payments/:paymentId/refund`, `GET /api/fees/students/:studentId/statement`.
- Extend the PostgreSQL race script with concurrent concession+payment attempts. Receipt numbering stays per-school gap-free; refunds use their own series if the owner wants (extend `school_counters`).

**2.2 Report cards** (5.3). Needs 2.0.
- Link existing: `GET /api/exams`, `GET /api/exams/:id/results`, `GET /api/exams/:id/students/:studentId`, `GET /api/exams/:id/my-results`, `GET /api/exams/grading-scales`, `GET /api/attendance/summary`, `GET /api/attendance/students/:id`, `GET /api/students/:id`, `GET /api/students/:id/enrollments`.
- New table `report_card_remarks` (tenant; student, academic_year, term, remark, author). New APIs: `GET /api/report-cards?academic_year_id=&section_id=`, `GET /api/report-cards/:studentId?academic_year_id=`, `PUT /api/report-cards/:studentId/remarks` (teacher of that class, principal, admin).
- Only **published** exam results; parents/students own children only; module `report_cards` in the matrix (principal view). Printable via `printElement` (PDF through browser print unless D7 says otherwise).

**2.3 Certificates** (5.3: bonafide, transfer, study, character). Needs 2.0.
- Table `certificates_issued` (tenant; number from `next_school_number(...,'certificate')` — extend the CHECK; type, student, issued_by, snapshot JSON, voided_at).
- APIs: `POST /api/certificates` (admin, principal), `GET /api/certificates?student_id=`, `GET /api/certificates/:id`, `POST /api/certificates/:id/void`. Templates are server-side data merged with `GET /api/students/:id` + school profile; reissue creates a new number, old one stays visible as superseded.

**2.4 ID cards and hall tickets** (5.3). Needs 2.0, D5.
- APIs: `GET /api/students/:id/id-card`, `GET /api/teachers/:id/id-card`, `GET /api/exams/:id/hall-tickets?section_id=` (candidates exist: `GET /api/exams/:id/candidates`). Data-only endpoints; printing in the UI. Staff access via matrix.

**2.5 Parent portal** (5.4).
- Reuse parent-scoped APIs (do not duplicate): `GET /api/students` (linked children), `GET /api/fees/invoices` (+receipts, 2.1 statement), `GET /api/attendance/students/:id`, `GET /api/homework`, `GET /api/notices`, `GET /api/timetable/slots`, `GET /api/exams` and `/:id/my-results`, `GET /api/transport/allocations`, `GET /api/calendar`.
- New aggregator: `GET /api/portal/children` (per child: unread notices, fee balance, 30-day attendance %, next exam, pending homework) and `GET /api/portal/children/:studentId/overview`.
- UI: child switcher, parent dashboard. "Separate parent login" = same `POST /api/auth/login`, parent role lands on the portal. **Leave applications and teacher communication are deferred to Batch 4 (needs D6).**
- Negative tests: a parent cannot see a non-linked child or another school's data (tracker item "verify parents can only access their linked children").

**2.6 Dashboard** (5.5). Extend `GET /api/dashboard` (`backend/src/models/dashboard.js`, already school-scoped; keep it that way).
- Add: today's timetable, monthly fee-collection trend (reuse `GET /api/fees/reports/collection`), quick actions (UI), recent students. Keep existing fields (`stats`, `insights`, `notices`, `calendar`). Every metric filtered by active school and role; principal view allowed, non-principal staff roles get the welcome page.

**2.7 Class and academic management** (5.7). Extend `/api/academic/:resource` (`GET/POST /:resource`, `GET/PUT/DELETE /:resource/:id`).
- Add resources `subject-combinations` (+ class link table), class capacity (sections already have `capacity`; add class-level target if wanted), class teachers (teacher assignments with `kind='class_teacher'` exist: `GET/POST /api/teachers/:id/assignments`). Verify and test school-scoped relationships between academic year, class, section and subject (cross-school FKs must be rejected).

**2.8 Students carry-over** (Batch 1 column C). Needs D3, D4.
- `POST /api/students/import` (dry run default, all-or-nothing, same-school reference validation; creates users with temporary passwords and returns a one-time CSV; parents linked by phone/email). Follows `bulkUpdate` in `backend/src/services/studentExchange.js`.
- `GET /api/students/:id/profile` aggregates tabs (personal, parent, academic, attendance, fees, results, homework, transport, documents, discipline) + UI tabs on the existing `StudentDetails` page.
- Aadhaar only if D3 says so. Admin UI for login history: `GET /api/auth/admin/users/:userId/login-history`.
- UI hygiene: hide write controls for read-only roles using `user.readOnly` (see `frontend/src/api/permissions.js`).

## BATCH 3 — Operations, reports and settings (~50 tasks, 7 packages)

**3.1 Teacher and staff management** (5.6). Existing: `GET/POST/PUT/DELETE /api/staff`, `/api/staff/:id`, `/api/teachers` + assignments.
- New: staff attendance `GET/PUT /api/staff/attendance`, workload `GET /api/teachers/:id/workload` (assignments + weekly periods from `GET /api/timetable/slots`), staff documents (needs D1) `POST/GET /api/staff/:id/documents`. Access: principal and transport_manager view; never expose pay data beyond admin.

**3.2 Attendance enhancements** (5.8). Existing: `GET /api/attendance/calendar|sections|register|summary|audit|students/:id`, `PUT /api/attendance/register`.
- New: low-attendance alerts `GET /api/attendance/alerts?threshold=&from=&to=`, monthly report `GET /api/attendance/reports/monthly?section_id=&month=`, correction approval flow (`POST /api/attendance/corrections`, `POST /api/attendance/corrections/:id/approve|reject`) using the existing audit history; bulk marking via the existing register (verify the bulk path and add tests for capacity of large sections).

**3.3 Homework enhancements** (5.9). Existing: `GET/POST /api/homework`, `/:id`, `/:id/archive`, `/:id/complete`.
- New (needs D1): attachments `POST /api/homework/:id/attachments`, `GET /api/homework/:id/attachments/:aid`; submissions `POST /api/homework/:id/submissions`, `GET /api/homework/:id/submissions`; feedback `PUT /api/homework/:id/submissions/:studentId/feedback`. Strict MIME (PDF/JPEG/PNG) and size checks; visibility = same rules as homework (student/parent linked, teacher assigned, school scoped).

**3.4 Exams enhancements** (5.10). Existing: exams, papers, candidates, marks (`GET/PUT /api/exams/:id/papers/:paperId/marks`), `publish|reopen|cancel`, `grading-scales`, `audit`.
- New: exam types `GET/POST /api/exams/types`, optional class rank `GET /api/exams/:id/ranks`, principal remarks `PUT /api/exams/:id/students/:studentId/remarks`, marks editing restricted to the paper's teacher or admin (already scoped; add negative tests for principal and other teachers).

**3.5 Timetable enhancements** (5.11). Existing: `GET /api/timetable/calendar|assignments|rooms|slots`, `POST/PUT` slots, `POST /slots/:id/deactivate`, `GET /slots/:id/audit` (DB exclusion constraint already blocks section/teacher/room overlaps).
- New: periods and breaks `GET/PUT /api/timetable/periods`, weekly view `GET /api/timetable/week?section_id=`, teacher-wise `GET /api/timetable/teachers/:teacherId`. Verify conflict prevention with explicit concurrency tests.

**3.6 Reports and exports** (5.12). Existing: `GET /api/students/export.csv`, `GET /api/fees/reports/collection`, `/defaulters`, `GET /api/attendance/summary`.
- New common endpoint `GET /api/reports/:name?format=csv|xlsx|pdf&academic_year_id=&from=&to=&class_id=&section_id=` for students, attendance, fees-collection, defaulters, exam-results (needs D7). Role permissions and active-school scope enforced in the query, not the UI; test that exports never include another school's rows.

**3.7 Settings** (5.13 remainder). Needs 2.0.
- `GET/PUT /api/settings/academic-years` (reuse `/api/academic/academic-years`), `GET /api/settings/permissions` (read-only view of the matrix), fee configuration screen over `/api/fees/structures`, `GET/PUT /api/settings/notifications` (preferences only; no delivery channel exists), backup/restore documentation in `docs/`. Settings isolated per school (negative tests).

## BATCH 4 — Scope decision, acceptance and release (~30 tasks, 6 packages)

**4.0 Record decision D6** (tracker 5.14) in `docs/DECISIONS.md` before any code.

**4.1 Leave management (only if D6 says yes).** Tables `leave_requests` (student or staff), `leave_balances` (staff). APIs: `POST/GET /api/leave/students`, `POST /api/leave/students/:id/approve|reject`, `POST/GET /api/leave/staff`, same for approval. Include the parent-portal leave application and teacher communication (`POST/GET /api/messages`, scoped to teacher–parent pairs of linked children). Payroll is Phase 2 unless the owner says otherwise.

**4.2 Environment readiness** (tracker section 7). Verify `backend/.env.example` and `backend/production.env.example`, document PostgreSQL variables, SSL, pool/timeouts, migration command and order, separate test database config, guard against pointing tests at production, Docker Compose health checks and volumes, PostgreSQL 17 in CI, backup/restore commands, and the owner's later database-linking checklist.

**4.3 Sprint 8 acceptance and readiness** (tracker section 6).
- 6.1: full backend suite and `npm run test:postgres` on **PostgreSQL 17**; clean-database and upgrade migrations; frontend suite and build; record commit SHA and CI links; never run destructive scripts on production.
- 6.2: browser acceptance per role: School Admin, Principal, Teacher, Class Teacher (a teacher assignment with `kind='class_teacher'`, not a separate role), Accountant, Parent, Student (plus Receptionist, Librarian, Transport Manager); mobile layouts; log defects and retest.
- 6.3: daily automated backups, off-site copy, restore test, DR document, retention, restricted access (D9).
- 6.4: audit-log and login-history review, DPDP Act review, Aadhaar review, retention/archival practice, restricted access to sensitive data.
- 6.5: HTTPS, rate limiting (auth routes already limited; review the rest), validation, XSS and SQL-injection review, authz review, session and password-reset review, **MFA for privileged users** (D8, TOTP: `POST /api/auth/mfa/enroll|verify`), `npm audit`, confirm no secrets in Git (run a secret scan over history).
- 6.6: load test with thousands of students, pagination checks, `EXPLAIN` on dashboard/report queries, record measurements.
- 6.7: production migration plan, rollback plan, environment variable docs, deployment and health-check steps, logs/monitoring, **owner approval before any production migration or deployment**.

**4.4 Phase 2 and Phase 3 (deferred, 13 tracker items):** not part of Phases 1–4 unless the owner promotes them.

## Handoff files (REQUIRED)

- When **Batch 2** is finished, the Batch 2 agent **must generate `BATCH_2_HANDOFF.md`** (and a zip of the code) with this document's structure: status with columns A/B/C, PR map in merge order, exact verification status, what exists, carried-forward items, decisions, conventions, run instructions, and the **exact APIs to link for Batch 3** (as in the Batch 3 roadmap above, updated with anything that changed). It must end by instructing the Batch 3 agent to generate `BATCH_3_HANDOFF.md` the same way.
- The **Batch 3** agent must generate `BATCH_3_HANDOFF.md` with the same structure and instruct the Batch 4 agent to generate `BATCH_4_HANDOFF.md`.
- The **Batch 4** agent must generate `BATCH_4_HANDOFF.md` (final) containing the acceptance results, defect log, deployment/rollback status, and a "what is deferred" list.
- Every handoff must say plainly what was **not** run or verified.

## Run it

```bash
cd backend && npm ci && npm test                     # 106 tests, PGlite
cd ../frontend && npm ci && npm test && npm run build
# real database check (disposable local DB only), from backend/:
POSTGRES_TEST_DATABASE_URL=postgres://USER:PASS@localhost:5432/DBNAME npm run test:postgres
```

---

## Appendix A — API inventory at `c7e5457` (142 routes found by regex)

Prefix `/api`. All routes except `/api/auth/login` and `/api/auth/refresh` require authentication; roles are enforced per router (`moduleAccess`, `authorize`).
**Not shown by the regex** (registered in a loop in `backend/src/routes/students.js`): `GET /api/students`, `GET /api/students/:id`, `POST /api/students`, `PUT /api/students/:id`, `DELETE /api/students/:id`, and the same five under `/api/parents`.

### /api/academic (5)
```
GET /api/academic/:resource
GET /api/academic/:resource/:id
POST /api/academic/:resource
PUT /api/academic/:resource/:id
DELETE /api/academic/:resource/:id
```
### /api/attendance (7)
```
GET /api/attendance/calendar
GET /api/attendance/sections
GET /api/attendance/register
PUT /api/attendance/register
GET /api/attendance/summary
GET /api/attendance/audit
GET /api/attendance/students/:id
```
### /api/auth (13)
```
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET /api/auth/me
POST /api/auth/admin/users/:userId/revoke-sessions
GET /api/auth/admin/users/:userId/login-history
GET /api/auth/schools
POST /api/auth/switch-school
GET /api/auth/sessions
DELETE /api/auth/sessions/:id
POST /api/auth/logout-all
GET /api/auth/login-history
POST /api/auth/change-password
```
### /api/calendar (4)
```
GET /api/calendar
POST /api/calendar
PUT /api/calendar/:id
DELETE /api/calendar/:id
```
### /api/dashboard (1)
```
GET /api/dashboard
```
### /api/demo (2)
```
GET /api/demo
POST /api/demo
```
### /api/exams (22)
```
GET /api/exams/calendar
GET /api/exams/grading-scales
POST /api/exams/grading-scales
GET /api/exams
POST /api/exams
GET /api/exams/:id
GET /api/exams/:id/papers
POST /api/exams/:id/papers
PUT /api/exams/:id/papers/:paperId
DELETE /api/exams/:id/papers/:paperId
GET /api/exams/:id/candidates
POST /api/exams/:id/candidates
DELETE /api/exams/:id/candidates/:studentId
GET /api/exams/:id/papers/:paperId/marks
PUT /api/exams/:id/papers/:paperId/marks
POST /api/exams/:id/publish
POST /api/exams/:id/reopen
POST /api/exams/:id/cancel
GET /api/exams/:id/my-results
GET /api/exams/:id/results
GET /api/exams/:id/students/:studentId
GET /api/exams/:id/audit
```
### /api/fees (16)
```
GET /api/fees/calendar
GET /api/fees/structures
POST /api/fees/structures
PUT /api/fees/structures/:id
GET /api/fees/reports/collection
GET /api/fees/reports/defaulters
GET /api/fees/summary
GET /api/fees/invoices
POST /api/fees/invoices
GET /api/fees/invoices/:id
POST /api/fees/invoices/:id/void
GET /api/fees/invoices/:id/payments/:paymentId/receipt
GET /api/fees/invoices/:id/payments
POST /api/fees/invoices/:id/payments
POST /api/fees/invoices/:id/payments/:paymentId/reverse
GET /api/fees/invoices/:id/events
```
### /api/homework (7)
```
GET /api/homework
GET /api/homework/:id
POST /api/homework
PUT /api/homework/:id
POST /api/homework/:id/archive
POST /api/homework/:id/complete
DELETE /api/homework/:id/complete
```
### /api/notices (10)
```
GET /api/notices/calendar
GET /api/notices/manage
GET /api/notices
POST /api/notices
GET /api/notices/:id
PUT /api/notices/:id
POST /api/notices/:id/publish
POST /api/notices/:id/read
GET /api/notices/:id/readers
GET /api/notices/:id/audit
```
### /api/staff (5)
```
GET /api/staff
GET /api/staff/:id
POST /api/staff
PUT /api/staff/:id
DELETE /api/staff/:id
```
### /api/students (12)
```
GET /api/students/export.csv
POST /api/students/promote
POST /api/students/bulk-update
GET /api/students/:id/parents
POST /api/students/:id/parents
DELETE /api/students/:id/parents/:parentId
GET /api/students/:id/enrollments
POST /api/students/:id/enrollments
PUT /api/students/:id/enrollments/:enrollmentId
DELETE /api/students/:id/enrollments/:enrollmentId
POST /api/students/:id/status
GET /api/students/:id/status-history
```
### /api/teachers (10)
```
GET /api/teachers
GET /api/teachers/:id
POST /api/teachers
PUT /api/teachers/:id
DELETE /api/teachers/:id
GET /api/teachers/:id/assignments
POST /api/teachers/:id/assignments
PUT /api/teachers/:id/assignments/:assignmentId
DELETE /api/teachers/:id/assignments/:assignmentId
GET /api/teachers/:id/assignments/:assignmentId/roster
```
### /api/timetable (11)
```
GET /api/timetable/calendar
GET /api/timetable/assignments
GET /api/timetable/rooms
POST /api/timetable/rooms
PUT /api/timetable/rooms/:id
GET /api/timetable/slots
POST /api/timetable/slots
GET /api/timetable/slots/:id
PUT /api/timetable/slots/:id
POST /api/timetable/slots/:id/deactivate
GET /api/timetable/slots/:id/audit
```
### /api/transport (13)
```
GET /api/transport/vehicles
POST /api/transport/vehicles
PUT /api/transport/vehicles/:id
GET /api/transport/routes
POST /api/transport/routes
PUT /api/transport/routes/:id
POST /api/transport/routes/:id/stops
PUT /api/transport/stops/:stopId
DELETE /api/transport/stops/:stopId
GET /api/transport/allocations
POST /api/transport/allocations
PUT /api/transport/allocations/:id
DELETE /api/transport/allocations/:id
```
### /api/users (4)
```
GET /api/users
POST /api/users
POST /api/users/:id/temporary-password
POST /api/users/:id/reset-password
```
