# Sprint 8 environment readiness checklist

Owner: school operator. Last reviewed: 2026-11-17 by the Batch 4 agent.
Status: **draft — needs operator sign-off before any production migration.**

This checklist consolidates tracker section 7 requirements. It is **documentation only**; the agent did not provision or verify any of the live infrastructure items below (column B in the handoff).

## 1. Environment variables

Required variables are validated by `backend/src/config/environment.js`. The validation fails fast at startup if any are missing or weak. See `backend/.env.example` and `backend/production.env.example` for the canonical list.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgres://user:pass@host:5432/dbname` (or `postgresql://`). PG 16+ supported; PG 17 target for production. |
| `JWT_SECRET` | yes | ≥48 chars OR a 32-byte base64 secret (Render-style). Never reuse across environments. |
| `FRONTEND_ORIGIN` | yes | Full origin URL (`https://app.example.com`). Must be HTTPS in production. |
| `NODE_ENV` | yes | `production` for prod. Production mode rejects non-HTTPS FRONTEND_ORIGIN and `replace-*` JWT secrets. |
| `PORT` | no (default 4000) | Render assigns. |
| `TRUST_PROXY` | no (default 0) | Set to 1 only behind a trusted reverse proxy that sets `X-Forwarded-*` headers correctly. |
| `DATABASE_CA_CERT` / `DATABASE_CA_CERT_FILE` | no | Required only for managed Postgres that requires a CA cert (e.g. Azure Database for PostgreSQL). |

## 2. SSL and pool configuration

- The pool is configured via `backend/src/config/database-options.js`. Defaults: `max: 10`, `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 2_000`. Tune `max` for the expected concurrent request count.
- SSL is enabled when `DATABASE_URL` contains `sslmode=require` or when `DATABASE_CA_CERT(_FILE)` is set. The agent did NOT verify SSL on a real managed Postgres.
- Set `statement_timeout` and `idle_in_transaction_session_timeout` on the production DB role to prevent runaway queries. Suggested: 30s and 60s respectively.

## 3. Migration command and order

```bash
# From backend/:
node src/database/migrate.js    # applies all pending migrations in alphabetical order, idempotent
# Or rely on application startup (migrate.js runs as part of server boot).
```

Migrations are listed in `tests/migrations.test.js`. As of this snapshot the order is **001 → 039**. **Next free number: 040.**

For an upgrade with existing data:
1. Take a backup (`pg_dump` per D9).
2. Run migrations on a staging copy first.
3. Run `npm run test:postgres` against the upgraded staging DB.
4. Only then migrate production.

## 4. Test database configuration

`backend/package.json` exposes `npm run test:postgres`. It expects `POSTGRES_TEST_DATABASE_URL` to point at a **disposable** database. The script does NOT auto-create the database — the operator must provision it.

```bash
# Example (disposable local DB):
createdb school_test
POSTGRES_TEST_DATABASE_URL=postgres://localhost/school_test npm run test:postgres
```

**Guard against pointing tests at production:** `npm run test:postgres` refuses to run if `POSTGRES_TEST_DATABASE_URL` equals `DATABASE_URL` (this guard is enforced by the script — verify before each run). The PGlite-based `npm test` is fully self-contained and never touches a real database.

## 5. Docker Compose

`docker-compose.yml` defines `db` (PostgreSQL 16) and `web` (the backend). `docker-compose.dev.yml` adds hot reload. `docker-compose.prod.yml` is a stub — the operator must review volumes and health checks before production use.

Required health checks (verify they exist in `docker-compose.prod.yml` before deploying):
- `db`: `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` every 10s, 5 retries.
- `web`: `GET /api/health` every 30s.

Volumes: the `db` data volume MUST be a named volume, not a bind mount, to survive container recreation.

## 6. PostgreSQL 17 in CI

The GitHub Actions workflow at `.github/workflows/` (check and refresh before merging) should run `npm run test:postgres` against PostgreSQL 17. The agent did NOT verify this — column B. The new migrations use only standard Postgres features (CHECK, triggers, `next_school_number`, `bytea`, `rank()`, `EXISTS`) that should work unchanged on PG 17.

## 7. Backup and restore (per D9)

- **Backup target:** off-site object storage (S3, GCS, Azure Blob — operator's choice).
- **Schedule:** daily `pg_dump --format=custom` of the production database.
- **Retention:** 30 daily snapshots + 12 monthly snapshots (first daily of each month).
- **Access:** restricted to the deployment operator; credentials in environment variables, never in Git.
- **Restore test:** at least once per quarter, restore a random daily snapshot to a staging database and run `npm run test:postgres` against it. Record the result in `docs/qa/restore-test-YYYY-MM-DD.md`.

Reference: `docs/deployment/database-backups.md` (existing — review and refresh).

## 8. Owner's later database-linking checklist

When the operator links the application to a fresh production database:
1. Create a dedicated Postgres role `school_app` with `CONNECT` on the database and `CREATE` on the public schema (or use a managed Postgres role).
2. Set `DATABASE_URL` to use that role.
3. Run migrations (`node src/database/migrate.js`).
4. Bootstrap the administrator via the startup admin flow (`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` environment variables for the first boot only).
5. Verify `GET /api/health` returns `{status:'ok'}`.
6. Sign in as the bootstrapped admin and immediately enroll MFA (per 4.3 / D8).
7. Create the school record, set the school profile (`PUT /api/settings/school`), and upload the logo.
8. Create staff members and assign roles.
9. Run `npm audit` and a secret scan over the Git history (see `docs/qa/initial-security-assessment-2026-11-02.md`).
