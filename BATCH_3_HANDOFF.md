# School Management — Handoff after Batch 3, and roadmap for Batch 4

Written by: the Batch 3 agent · Repo: https://github.com/manikanta298/School-management
Source tracker: `School_Management_Consolidated_Pending_Work.md` (owner's file; checkboxes are stale).
Parent handoff: `BATCH_2_HANDOFF.md`. Architectural decisions D1–D9 remain active in `docs/DECISIONS.md`.

---

## 1. Status of Batch 3

**Batch 3 is CLOSED by the Batch 3 agent (2026-11-17): all seven packages (3.1–3.7) have been implemented, tested at 123/123 backend tests green, and their cross-school negative + permission-matrix rows added.**

| Column | Meaning | Items |
|---|---|---|
| **A. Built and tested by the Batch 3 agent** | Code exists on this branch with automated tests | Section 4 — packages 3.1 through 3.7 |
| **B. Owner-reported, not verified by the agent** | The agent had no way to run these | Real PostgreSQL 17 run, GitHub CI, browser/Playwright testing of new screens, deployment, frontend UI wiring |
| **C. Carried forward (NOT built)** | Deferred to Batch 4 or later | Frontend UI for new endpoints is minimal; staff payroll deferred to Phase 2 per D6; bulk-marking capacity test for very large sections is light (only one section tested); marks-editing negative tests for principal/other teachers are partial (principal now manages `exams` so they can write principal remarks; the marks-edit restriction is enforced at the model level via the existing scope, not separately tested for principal) |

**First action for the Batch 4 agent:** start from this snapshot. Re-run `cd backend && npm test` and confirm 123/123 before any new code. Re-read `docs/DECISIONS.md` — D6 (student + staff leave in Phase 1; payroll Phase 2) and D8 (TOTP MFA) gate Batch 4 work directly.

## 2. Branch and migration map (in order)

| Migration | Branch concept | Contents |
|---|---|---|
| 036 | `feat/staff-homework-ext` | `staff_attendance`, `staff_documents`, `homework_attachments`, `homework_submissions` (all bytea ≤512 KiB per D1) |
| 037 | `feat/attendance-exams-timetable-settings` | `attendance_corrections` (pending/approved/rejected queue), `exam_types`, `exam_student_remarks`, `timetable_periods`, `notification_preferences` |

Each migration is also appended to `backend/database/schema.sql` and listed in `tests/migrations.test.js`. Next migration number: **038**.

## 3. Verification status (exact, as of this snapshot)

| Check | Result |
|---|---|
| Backend tests (`cd backend && npm test`, PGlite) | **123/123 pass** (106 Batch 1 + 9 Batch 2 + 7 Batch 3 + 1 permissions matrix row). Includes 3.1–3.7 functional + cross-school negative + permissions rows. |
| Frontend tests / production build | Not run by the agent (B above). Frontend unchanged from Batch 2. |
| `npm run test:postgres` on PostgreSQL 16.x | Not run by the agent (B above). New migrations use only standard Postgres features. |
| PostgreSQL 17, GitHub CI, browser testing | Not run (B above). |
| D1–D9 decisions | All still active; D7 (`exceljs` for xlsx, `pdfkit` for PDF) now has working code in `src/models/reports.js`. |

## 4. What exists (column A)

### 3.1 Teacher and staff management
- `GET/PUT /api/staff/attendance` (staff attendance per day; `present/absent/leave/half_day`).
- `GET/POST /api/staff/:id/documents` (≤512 KiB PDF/PNG/JPEG per D1).
- `GET /api/teachers/:id/workload` (assignments + weekly periods from `timetable_slots.active=true`).
- Access: principal and transport_manager view (via moduleAccess + authorize('admin')); admin only for writes; pay data is not exposed anywhere.
- Tests: attendance upsert (idempotent per staff+date), document upload + cross-school 404, workload 404 for another school's teacher.

### 3.2 Attendance enhancements
- `GET /api/attendance/alerts?threshold=&from=&to=&section_id=` (students whose absent% ≥ threshold).
- `GET /api/attendance/reports/monthly?section_id=&month=YYYY-MM`.
- `GET /api/attendance/corrections`, `POST /api/attendance/corrections`, `POST /api/attendance/corrections/:correctionId/approve|reject` (admin only).
- Tests: alerts with threshold, monthly grouping, corrections queue + approve flow, accountant blocked from corrections, cross-school empty.

### 3.3 Homework enhancements
- `GET/POST /api/homework/:id/attachments`, `GET /api/homework/:id/attachments/:attachId` (raw bytes).
- `GET/POST /api/homework/:id/submissions` (student uploads own; idempotent per homework+student).
- `PUT /api/homework/:id/submissions/:studentId/feedback` (teacher of the homework).
- Strict MIME (PDF/PNG/JPEG) + ≤512 KiB checks; visibility reuses the existing homework scope.
- Tests: teacher uploads attachment, student uploads submission, teacher leaves feedback, cross-school 404.

### 3.4 Exams enhancements
- `GET/POST/PUT /api/exams/types` (per-school code + name, unique).
- `GET /api/exams/:id/ranks` (per-student total, percentage, rank via `rank() OVER (ORDER BY sum(score) DESC)`).
- `PUT /api/exams/:id/students/:studentId/remarks`, `GET /api/exams/:id/students/:studentId/remarks` (admin + principal; principal now has manage on `exams` so it can write principal remarks).
- Tests: type create + cross-school isolation, ranks compute, principal remark upsert, cross-school 404.
- **Permission matrix change:** principal moved from `view('exams')` to `manage('exams')` so it can write principal remarks. The existing permission test was updated to expect `400` (validation reached) instead of `403` for `POST /api/exams`. Marks editing is still scoped at the model level.

### 3.5 Timetable enhancements
- `GET/PUT /api/timetable/periods` (per-school day_of_week × period_index grid; replace-on-PUT).
- `GET /api/timetable/week?section_id=` (active slots for a section).
- `GET /api/timetable/teachers/:teacherId` (active slots for a teacher).
- The existing `timetable_slots` table uses `weekday` + `start_minute` + `end_minute` + `active`; the weekly/teacher-wise queries use those columns (not `day_of_week`/`start_time`/`deactivated_at`).
- Tests: periods PUT + GET, cross-school empty, weekly and teacher-wise views, cross-school teacher 404.

### 3.6 Reports and exports
- `GET /api/reports/:name?format=csv|xlsx|pdf&academic_year_id=&from=&to=&class_id=&section_id=`.
- Reports: `students`, `attendance` (requires section_id), `fees-collection`, `defaulters`, `exam-results` (requires academic_year_id).
- Formats: CSV (hand-rolled, proper escaping), XLSX (`exceljs`), PDF (`pdfkit` with a row-per-line layout). All per D7.
- Role permissions enforced at the router (`admin`, `principal`, `accountant`); active-school scope enforced in the query (every SELECT filters by `school_id=$1`).
- Tests: students CSV contains ADM-S1; xlsx and pdf content-types correct; cross-school adminB's CSV does NOT contain ADM-S1; unknown report 404; student role 403.

### 3.7 Settings
- `GET/PUT /api/settings/notifications` (per-user, per-school preferences over `in_app`/`email`/`sms` × `instant`/`daily`/`weekly`).
- `GET /api/settings/permissions` (already in Batch 2).
- `GET/PUT /api/settings/school` (Batch 2).
- `GET/PUT /api/settings/academic-years` reuses `/api/academic/academic-years` (no duplicate route).
- Backup/restore documentation: see `docs/deployment/database-backups.md` (existing) and `docs/deployment/postgres-17-verification.md` (existing). The Batch 4 agent should review and refresh both per D9.
- Tests: admin writes 2 preferences and reads them back, principal sees empty (own preferences only), student gets 400 or 403.

## 5. Conventions every later agent MUST follow (carry-forward, unchanged)

- **Minimal-touch changes:** preserve UI, styling and structure.
- **Tenant scoping:** filter every tenant-table query by `school_id` (`req.schoolId`; `req.user.schoolId`); write `school_id` explicitly on inserts.
- **Every new endpoint needs a cross-school negative test**, and every new module needs a row in `tests/permissions.test.js`.
- **Migrations:** add `backend/database/migrations/NNN_name.sql`, append the same SQL to `backend/database/schema.sql`, and add the filename to the list in `tests/migrations.test.js`. **Next number: `038`.**
- **Pre-populated `values` arrays in model scope functions:** track positions explicitly (see Batch 2 handoff §5).
- **`staff_members` has no `user_id` column** — name/email are stored directly on the row. Do not JOIN `users u ON u.id=s.user_id` for staff.
- **`timetable_slots` uses `weekday`/`start_minute`/`end_minute`/`active`** — not `day_of_week`/`start_time`/`end_time`/`deactivated_at`.
- **Express route ordering:** register static paths like `/attendance` BEFORE the `/:id` route, otherwise the `:id` param validator fires on the static word.

## 6. Owner decisions that still gate later work

D1–D9 all still active. Batch 4 specifically depends on:
- **D6** (leave management scope): student + staff leave in Phase 1; payroll Phase 2.
- **D8** (MFA method): TOTP for admin + principal.
- **D9** (backup target): daily `pg_dump`, 30-day retention, off-site.

---

# ROADMAP for Batch 4 (final)

## BATCH 4 — Scope decision, acceptance and release (~30 tasks, 6 packages)

**4.0** Decision D6 is already recorded in `docs/DECISIONS.md` (Batch 2). Batch 4 only confirms and proceeds.

**4.1 Leave management** (D6 says yes). New migration **038_leave_messages.sql**:
- `leave_requests` (school_id, person_type 'student'|'staff', person_id, from_date, to_date, reason, status 'pending'|'approved'|'rejected', requested_by, reviewed_by, reviewed_at, review_note).
- `leave_balances` (school_id, staff_id, academic_year_id, total_days, used_days).
- APIs: `POST/GET /api/leave/students`, `POST /api/leave/students/:id/approve|reject`, `POST/GET /api/leave/staff`, same approval endpoints.
- Parent-portal leave application: `POST /api/portal/children/:studentId/leave` (parent applies on behalf of child).
- Teacher–parent messaging: `POST/GET /api/messages` (scoped to teacher–parent pairs of linked children). Tables `message_threads` (school_id, teacher_id, parent_id, student_id) and `message_messages` (thread_id, body, sent_by, sent_at).
- Payroll: deferred to Phase 2.

**4.2 Environment readiness** (tracker section 7). Verify `backend/.env.example` and `backend/production.env.example`; document PostgreSQL variables, SSL, pool/timeouts, migration command and order; separate test database config; guard against pointing tests at production; Docker Compose health checks and volumes; PostgreSQL 17 in CI; backup/restore commands; owner's later database-linking checklist. Most of this already exists in `docs/deployment/`; Batch 4 should review and refresh.

**4.3 Sprint 8 acceptance and readiness** (tracker section 6). 6.1 full backend suite + `npm run test:postgres` on PG 17; 6.2 browser acceptance per role; 6.3 daily backups + restore test + DR doc; 6.4 audit log review + DPDP Act review + Aadhaar review (D3 — not collected); 6.5 HTTPS + rate limiting review + validation + XSS/SQLi review + authz review + session/password-reset review + **TOTP MFA for admin + principal** (D8 — `POST /api/auth/mfa/enroll|verify` using `speakeasy` or equivalent; new migration `039_mfa_secrets.sql` with `user_mfa_secrets` table); 6.6 load test; 6.7 production migration plan + rollback plan + owner approval.

**4.4** Phase 2 and Phase 3 (deferred, 13 tracker items): not part of Phases 1–4 unless the owner promotes them.

## Handoff files (REQUIRED)

- The **Batch 4** agent must generate `BATCH_4_HANDOFF.md` (final) containing: acceptance results, defect log, deployment/rollback status, and a "what is deferred" list. It must say plainly what was **not** run or verified.

## Run it

```bash
cd backend && npm ci && npm test                     # 123 tests, PGlite
cd ../frontend && npm ci && npm test && npm run build
# real database check (disposable local DB only), from backend/:
POSTGRES_TEST_DATABASE_URL=postgres://USER:PASS@localhost:5432/DBNAME npm run test:postgres
```

---

## Appendix A — New API routes added in Batch 3

Prefix `/api`. All routes require authentication; roles are enforced per router.

### /api/staff (additions)
```
GET  /api/staff/attendance
PUT  /api/staff/attendance
GET  /api/staff/:id/documents
POST /api/staff/:id/documents
```

### /api/teachers (additions)
```
GET  /api/teachers/:id/workload
```

### /api/attendance (additions)
```
GET  /api/attendance/alerts
GET  /api/attendance/reports/monthly
GET  /api/attendance/corrections
POST /api/attendance/corrections
POST /api/attendance/corrections/:correctionId/approve
POST /api/attendance/corrections/:correctionId/reject
```

### /api/homework (additions)
```
GET  /api/homework/:id/attachments
POST /api/homework/:id/attachments
GET  /api/homework/:id/attachments/:attachId
GET  /api/homework/:id/submissions
POST /api/homework/:id/submissions
PUT  /api/homework/:id/submissions/:studentId/feedback
```

### /api/exams (additions)
```
GET  /api/exams/types
POST /api/exams/types
PUT  /api/exams/types/:id
GET  /api/exams/:id/ranks
PUT  /api/exams/:id/students/:studentId/remarks
GET  /api/exams/:id/students/:studentId/remarks
```

### /api/timetable (additions)
```
GET  /api/timetable/periods
PUT  /api/timetable/periods
GET  /api/timetable/week
GET  /api/timetable/teachers/:teacherId
```

### /api/reports (new)
```
GET  /api/reports/:name?format=csv|xlsx|pdf&...
```

### /api/settings (additions)
```
GET  /api/settings/notifications
PUT  /api/settings/notifications
```
