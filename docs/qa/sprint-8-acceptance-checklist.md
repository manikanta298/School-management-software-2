# Sprint 8 acceptance and security review checklist

Owner: school operator. Last reviewed: 2026-11-17 by the Batch 4 agent.
Status: **draft — needs operator execution and sign-off.**

This is the **acceptance criteria** checklist for tracker section 6 (Sprint 8). Items the agent executed are marked DONE; items that need operator execution are marked TODO. The agent executed only what it could in the PGlite test environment.

## 6.1 Backend suite and PostgreSQL migrations

- [DONE] `cd backend && npm test` passes at **126/126** on PGlite (commit at this snapshot).
- [DONE] Migrations 001–039 apply cleanly to an empty PGlite schema (asserted by `tests/migrations.test.js`).
- [TODO] `npm run test:postgres` on PostgreSQL **16.x** (operator provision disposable DB).
- [TODO] `npm run test:postgres` on PostgreSQL **17** (CI).
- [TODO] Upgrade test: restore a `pg_dump` from a pre-migration production DB, run migrations 031–039 against it, run `npm run test:postgres`. Verify per-school counters (invoice/receipt/refund/certificate) seed correctly.
- [TODO] Record commit SHA and CI links in `docs/qa/sprint-8-acceptance-YYYY-MM-DD.md`.
- [TODO] **Never run destructive scripts on production.** The migration runner is idempotent and transactional, but verify backups before any production migration.

## 6.2 Browser acceptance per role

The agent did NOT execute browser tests (column B). The operator must run through each role's primary screens:

- [ ] **School Admin**: dashboard, school profile + logo, students CRUD + import + profile tabs, fees (invoices, concessions, instalments, penalties, refunds, statements, events), staff CRUD + attendance + documents, teachers + workload, attendance (register, alerts, monthly, corrections), homework (CRUD + attachments + submissions + feedback), exams (types, papers, marks, publish, ranks, remarks), timetable (slots, periods, weekly, teacher-wise), transport, notices, calendar, certificates, report cards, settings, reports (csv/xlsx/pdf), leave (students + staff + balances), messages, MFA enrollment.
- [ ] **Principal**: same as admin but read-only on fees/staff/timetable; write on notices, calendar, certificates, exams (remarks), report card remarks.
- [ ] **Teacher**: homework (own), attendance (own sections), exams (own papers' marks), timetable (own), messages with parents, report card remarks for own students.
- [ ] **Class Teacher** (a teacher with `kind='class_teacher'` assignment, not a separate role): full teacher scope plus class-level views.
- [ ] **Accountant**: fees (full manage), students/parents/notices/calendar (view), reports (csv/xlsx/pdf). Blocked from staff, transport, exams, dashboard, homework, timetable, certificates, report cards, leave approvals, messages.
- [ ] **Receptionist**: students/parents (manage but not delete/promote/export), timetable/notices/calendar/report cards/certificates (view).
- [ ] **Librarian**: students/notices/calendar (view only).
- [ ] **Transport Manager**: transport (manage), students/staff/notices/calendar (view).
- [ ] **Parent**: portal (children list + overview), report cards (own children), fees statements (own children), messages with teachers, leave applications on behalf of children.
- [ ] **Student**: own homework, own attendance, own exam results, own ID card, own report card.
- [ ] Mobile layouts: verify on a phone-width viewport.

Log defects in `docs/qa/sprint-8-defects.md` and retest after fixes.

## 6.3 Backups, restore, DR

- [TODO] Daily `pg_dump` scheduled and writing to off-site object storage (D9).
- [TODO] 30-day retention + 12 monthly snapshots configured.
- [TODO] Restore test executed at least once; result recorded in `docs/qa/restore-test-YYYY-MM-DD.md`.
- [TODO] DR document: RTO/RPO targets, recovery steps, contact tree.
- [TODO] Access restricted to the deployment operator.

## 6.4 Audit and privacy review

- [DONE] Audit log and login-history endpoints exist (`GET /api/auth/login-history`, `GET /api/auth/admin/users/:userId/login-history`, `GET /api/auth/sessions`).
- [TODO] Operator reviews audit log entries for completeness over a representative week.
- [TODO] DPDP Act review: confirm D3 (Aadhaar not collected) holds; confirm D1 (file size ≤512 KiB) and MIME checks reject anything else; confirm D9 (backup retention) is compliant.
- [TODO] Retention/archival: define how long audit logs, login events, and notice reads are kept. Suggested: audit logs 7 years, login events 1 year, notice reads 90 days.
- [TODO] Restricted access to sensitive data: pay data is not exposed anywhere (confirmed by code review); Aadhaar is not collected (D3); health/blood-group data is admin-only.

## 6.5 Security review (HTTPS, rate limiting, validation, XSS/SQLi, authz, MFA)

- [DONE] `helmet()` is applied; `x-powered-by` is disabled; `Cache-Control: private, no-store` on `/api/*`.
- [DONE] Rate limiting: 120 req/min/IP globally; auth routes stricter (20 per 15 min). Review the rest before production.
- [DONE] Validation: every POST/PUT body is validated by a zod schema. Untrusted strings are rejected if they contain control chars or `<>`.
- [DONE] SQL injection: every query uses parameterised values (`$1`, `$2`, …); no string concatenation of user input into SQL. The only string interpolation is for static identifiers from a allowlist (`resources` in `models/academic.js`).
- [DONE] XSS: response bodies are JSON; the frontend React layer escapes by default. The CSV export escapes formula-prefix characters (`=+-@\t\r`) by prefixing `'`.
- [DONE] Authz: every router uses `authenticate`; staff-role routers use `moduleAccess('<module>')`; destructive actions (delete, status change, promote, bulk-update, export, void, refund) are `adminOnly` or scoped to the acting user.
- [DONE] Session review: sessions are JWT access tokens (15 min) + refresh tokens (7 days, hashed at rest); sessions can be revoked; admin can force-sign-out any user; temporary passwords force a change at next login.
- [DONE] Password reset: admin-issued temporary passwords (`POST /api/users/:id/temporary-password`) and admin-chosen resets (`POST /api/users/:id/reset-password`) both set `must_change_password=true`.
- [DONE] **TOTP MFA** (D8) implemented in `src/services/mfa.js` + `POST /api/auth/mfa/enroll|verify|unenroll` + `GET /api/auth/mfa/status`. Enrollment requires a fresh login; verification accepts a 6-digit TOTP with a ±1 step window. Restricted to `admin` and `principal`.
- [TODO] Operator: enforce MFA enrollment for all admin and principal accounts before going live.
- [TODO] `npm audit` — fix or document any high-severity findings.
- [TODO] Secret scan over Git history (e.g. `git-secrets`, `trufflehog`) — confirm no secrets were ever committed.

## 6.6 Load test

- [TODO] Provision a staging DB with thousands of students (e.g. 5 000 across 50 classes).
- [TODO] Run a load test against the dashboard, fees summary, students list, attendance register, and reports endpoints.
- [TODO] Verify pagination on every list endpoint (default page size 25; max 100).
- [TODO] `EXPLAIN` on dashboard and report queries; add indexes where seq scans appear. The existing indexes cover the common filters; verify with real data volumes.
- [TODO] Record measurements in `docs/qa/sprint-8-load-test-YYYY-MM-DD.md`.

## 6.7 Production migration plan

- [TODO] Owner approval before any production migration. **No exceptions.**
- [TODO] Rollback plan: each migration is reversible in principle (write a down-migration if needed), but the practical rollback is to restore from the pre-migration `pg_dump` taken in step 3 of the environment-readiness doc.
- [TODO] Deployment steps: take backup → migrate → deploy backend → deploy frontend → smoke test → announce.
- [TODO] Logs/monitoring: ship backend logs to the operator's log aggregator; alert on 5xx rate and on DB pool exhaustion.
- [TODO] Health check: `GET /api/health` must return 200; wire it into the orchestrator's health check.
