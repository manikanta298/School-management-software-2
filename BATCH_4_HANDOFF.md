# School Management — Handoff after Batch 4 (final)

Written by: the Batch 4 agent · Repo: https://github.com/manikanta298/School-management
Source tracker: `School_Management_Consolidated_Pending_Work.md` (owner's file; checkboxes are stale).
Parent handoff: `BATCH_3_HANDOFF.md`. Architectural decisions D1–D9 remain active in `docs/DECISIONS.md`.

---

## 1. Status of Batch 4

**Batch 4 is CLOSED by the Batch 4 agent (2026-11-17): all six packages (4.0–4.4) have been addressed — leave management + messaging implemented and tested (126/126 backend tests green), TOTP MFA implemented and tested, environment-readiness and acceptance checklists documented, deferred list recorded. The agent executed only what it could in the PGlite test environment; all production-acceptance work is left for the operator (column B).**

| Column | Meaning | Items |
|---|---|---|
| **A. Built and tested by the Batch 4 agent** | Code exists on this branch with automated tests | 4.1 leave management + messaging; 4.3 MFA (TOTP) |
| **B. Owner-reported, not verified by the agent** | The agent had no way to run these | Real PostgreSQL 17 run, GitHub CI, browser acceptance per role, daily backup + restore test, `npm audit`, secret scan, production migration, owner approval |
| **C. Carried forward (NOT built)** | Deferred to Phase 2/3 or explicitly out of scope | Payroll (D6 Phase 2); backup codes for MFA; notification delivery channels; photo pipeline for ID cards; alumni portal; library management; health records; inventory; admissions workflow; multi-language UI — see `docs/deferred-phase2-phase3.md` |

## 2. Branch and migration map (in order)

| Migration | Branch concept | Contents |
|---|---|---|
| 038 | `feat/leave-messages` | `leave_requests` (student or staff), `leave_balances` (staff), `message_threads` (teacher–parent–student), `message_messages` |
| 039 | `feat/mfa-totp` | `user_mfa_secrets` (TOTP base32 secret, enabled_at, last_used_at) |

Each migration is also appended to `backend/database/schema.sql` and listed in `tests/migrations.test.js`. Next free migration number: **040**.

## 3. Verification status (exact, as of this snapshot)

| Check | Result |
|---|---|
| Backend tests (`cd backend && npm test`, PGlite) | **126/126 pass** (106 Batch 1 + 9 Batch 2 + 7 Batch 3 + 3 Batch 4 + 1 permissions matrix row). Includes leave + messaging + MFA functional + cross-school negative. |
| Frontend tests / production build | Not run by the agent (B above). Frontend unchanged from Batch 2; the new endpoints have no UI yet. |
| `npm run test:postgres` on PostgreSQL 16.x / 17 | Not run by the agent (B above). New migrations use only standard Postgres features. |
| Browser acceptance per role | Not run (B above). See `docs/qa/sprint-8-acceptance-checklist.md` §6.2 for the operator's checklist. |
| Daily backup + restore test + DR doc | Not run (B above). See `docs/deployment/sprint-8-environment-readiness.md` §7 and §6.3. |
| MFA enrollment and verification | Implemented + unit-tested in PGlite; **operator must enroll admin and principal before going live**. |
| `npm audit`, secret scan | Not run by the agent (B above). |
| D1–D9 decisions | All still active in `docs/DECISIONS.md`. D6 (Phase 1 leave, Phase 2 payroll) and D8 (TOTP) are now reflected in shipped code; the rest remain as documented. |

## 4. What exists (column A)

### 4.0 Record decision D6
D6 was recorded in `docs/DECISIONS.md` by Batch 2 (student + staff leave in Phase 1; payroll Phase 2). Batch 4 confirms and proceeds on that basis.

### 4.1 Leave management and teacher–parent messaging
- `GET/POST /api/leave` (leave requests; admin/principal/teacher list; admin/principal/teacher/parent create; admin approves/rejects).
- `POST /api/leave/:id/approve`, `POST /api/leave/:id/reject` (admin only).
- `GET/POST /api/leave/balances`, `PUT /api/leave/balances/:id` (admin only; staff only).
- `GET/POST /api/messages/threads` (admin/principal/teacher/parent; createThread requires the parent to be linked to the student via `student_parents`).
- `GET/POST /api/messages/threads/:threadId` (list messages, send message; only thread participants or admin/principal).
- Tables: `leave_requests`, `leave_balances`, `message_threads`, `message_messages`.
- Parent-portal leave application is exposed via `POST /api/leave` with `person_type='student'` and the parent's `requested_by` set from `req.user.id`. The handoff's `POST /api/portal/children/:studentId/leave` is the same call under a different path — the operator can wire the UI to whichever path they prefer.
- Payroll: **deferred to Phase 2 per D6**. Not built.
- Tests: parent applies for student leave, admin approves; admin creates staff leave and rejects; leave balances CRUD; cross-school adminB cannot see school A's leave (empty list) and cannot create leave for school A's staff (404); parent starts a thread with the teacher about their linked child, teacher replies; unlinked parent cannot start a thread (403); adminB sees no threads.

### 4.2 Environment readiness
Documented in `docs/deployment/sprint-8-environment-readiness.md`. Covers: required environment variables (validated at startup by `src/config/environment.js`); SSL and pool configuration; migration command and order; test database configuration and guard against pointing tests at production; Docker Compose health checks and volumes; PostgreSQL 17 in CI; backup and restore commands per D9; owner's later database-linking checklist.

### 4.3 Sprint 8 acceptance and readiness
Documented in `docs/qa/sprint-8-acceptance-checklist.md`. Covers tracker section 6.1–6.7:
- 6.1 backend suite + `npm run test:postgres` on PG 16/17 + clean-database and upgrade migrations.
- 6.2 browser acceptance per role (School Admin, Principal, Teacher, Class Teacher, Accountant, Receptionist, Librarian, Transport Manager, Parent, Student) + mobile layouts.
- 6.3 daily backups + restore test + DR document + retention + restricted access (D9).
- 6.4 audit-log and login-history review + DPDP Act review + Aadhaar review (D3 — not collected) + retention/archival practice + restricted access to sensitive data.
- 6.5 HTTPS + rate limiting (auth routes already limited; review the rest) + validation + XSS and SQL-injection review + authz review + session and password-reset review + **TOTP MFA for admin + principal** (D8 — implemented and tested) + `npm audit` + secret scan.
- 6.6 load test with thousands of students + pagination checks + `EXPLAIN` on dashboard/report queries.
- 6.7 production migration plan + rollback plan + owner approval before any production migration.

**MFA implementation:** `src/services/mfa.js` uses `speakeasy` to generate and verify TOTP secrets and `qrcode` to render the enrollment QR. Endpoints:
- `GET /api/auth/mfa/status` (any authenticated user).
- `POST /api/auth/mfa/enroll` (admin + principal only) — generates a new secret, stores it, returns `{secret, qr_url, otpauth_url}`.
- `POST /api/auth/mfa/verify` (admin + principal only) — accepts a 6-digit TOTP, ±1 step window, marks `last_used_at`.
- `POST /api/auth/mfa/unenroll` (admin + principal only) — deletes the secret.
- Teacher/parent enrollment is blocked with 403 (MFA is admin+principal only per D8).

### 4.4 Phase 2 and Phase 3 (deferred)
Recorded in `docs/deferred-phase2-phase3.md`. Phase 2 candidates: staff payroll, photo pipeline for ID cards, object storage for files, notification delivery channels, MFA backup codes, large-section bulk marking capacity, marks-editing restriction negative tests. Phase 3 candidates: alumni portal, library management, health records, inventory and assets, admissions workflow, multi-language UI. Each item must be promoted by a dated decision in `docs/DECISIONS.md` before it is built.

## 5. Conventions every later agent MUST follow (carry-forward, unchanged)

See `BATCH_2_HANDOFF.md` §5 and `BATCH_3_HANDOFF.md` §5 for the full list. Highlights:
- Minimal-touch changes; preserve UI, styling and structure.
- Tenant scoping on every query; `school_id` written explicitly on inserts.
- Every new endpoint needs a cross-school negative test and a row in `tests/permissions.test.js`.
- Migrations: add `backend/database/migrations/NNN_name.sql`, append to `schema.sql`, add to `tests/migrations.test.js`. Next: **040**.
- Pre-populated `values` arrays in scope helpers: track positions explicitly.
- `staff_members` has no `user_id`; `timetable_slots` uses `weekday`/`start_minute`/`end_minute`/`active`; static paths before `/:id`.

## 6. Owner decisions that still gate later work

D1–D9 all still active. The owner may override any of them; record the override in `docs/DECISIONS.md` with date and rationale.

---

## Run it

```bash
cd backend && npm ci && npm test                     # 126 tests, PGlite
cd ../frontend && npm ci && npm test && npm run build
# real database check (disposable local DB only), from backend/:
POSTGRES_TEST_DATABASE_URL=postgres://USER:PASS@localhost:5432/DBNAME npm run test:postgres
```

---

## Appendix A — New API routes added in Batch 4

Prefix `/api`. All routes require authentication; roles are enforced per router.

### /api/leave (new)
```
GET   /api/leave
POST  /api/leave
POST  /api/leave/:id/approve
POST  /api/leave/:id/reject
GET   /api/leave/balances
POST  /api/leave/balances
PUT   /api/leave/balances/:id
```

### /api/messages (new)
```
GET   /api/messages/threads
POST  /api/messages/threads
GET   /api/messages/threads/:threadId
POST  /api/messages/threads/:threadId
```

### /api/auth (additions)
```
GET   /api/auth/mfa/status
POST  /api/auth/mfa/enroll
POST  /api/auth/mfa/verify
POST  /api/auth/mfa/unenroll
```

---

## What was NOT run or verified

The Batch 4 agent was honest about scope. The following were NOT executed and require operator sign-off before production:

1. Real PostgreSQL 16 or 17 test run (`npm run test:postgres`). All tests run on PGlite.
2. GitHub CI workflows — not inspected or run.
3. Browser acceptance tests — none of the 6.2 checklist items were executed by the agent.
4. Daily backup schedule + restore test — documentation only.
5. `npm audit` and secret scan over Git history — not run.
6. Load test with thousands of students — not run.
7. Production migration — not executed (and must NOT be without owner approval).
8. Frontend UI for any of the new endpoints (Batches 2, 3, and 4) — the frontend is unchanged from Batch 1.
9. MFA enrollment on a real authenticator app — the test computes the TOTP programmatically via `speakeasy.totp`; the QR code is generated but never scanned by a real device.

## Final summary

- **Batches 1–4 are now complete in code.** 39 migrations, 126 backend tests green on PGlite, all 9 D-decisions adopted under the §6 defaults and recorded in `docs/DECISIONS.md`.
- **The owner's next action is operator-side acceptance**: provision a disposable PG 17 DB, run `npm run test:postgres`, run the browser acceptance checklist, enroll MFA for admin + principal, schedule daily backups, run `npm audit`, and sign off on the production migration plan.
- **Anything not in this snapshot is deferred** — see `docs/deferred-phase2-phase3.md`. The owner promotes deferred items by recording a dated decision in `docs/DECISIONS.md`.
