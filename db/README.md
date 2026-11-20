# Database scripts

Scripts for cleaning up and populating the school management database.

## Files

| File | Purpose |
|---|---|
| `cleanup.sql` | Defensive SQL cleanup script — disables audit triggers, truncates all tenant-scoped tables in FK-safe order, preserves admin account + schools + schema_migrations, resets school_counters. Run as superuser. |
| `populate_data.py` | Populates the database with realistic test data using standard Indian names (20 students, 10 parents, 4 teachers, 6 sections, 20 fee invoices, 6 exams, 80 attendance entries, 90 timetable slots, 6 notices, etc.). |
| `seed_academic.sql` | Bootstrap seed for academic year + terms + classes + sections + subjects + rooms (used by populate_data.py for deterministic UUIDs). |

## Usage

```bash
# 1. Take a backup before cleanup
pg_dump "$DATABASE_URL" > db_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run cleanup (clears all tenant data; preserves admin)
psql "$DATABASE_URL" -f cleanup.sql
# Or via psycopg2 (the script supports multi-statement execution)

# 3. Populate realistic test data
DATABASE_URL="postgres://..." python3 populate_data.py
```

## Safety

- The cleanup script uses `SET session_replication_role = replica` to bypass audit triggers during truncate. This is required because audit tables (`attendance_audit`, `fee_events`, `exam_events`, etc.) are write-only by trigger and cannot be `TRUNCATE`d as a regular user.
- The script preserves:
  - `schools` row
  - The admin user (`role = 'admin'`)
  - The admin's `school_memberships` row
  - `schema_migrations` (so the app's migration state stays intact)
- After cleanup, `school_counters` is reset to 1 so invoice/receipt/certificate numbering restarts fresh.

## What's intentionally NOT exposed

- No destructive cleanup endpoint in the API (by design — audit history is protected)
- The cleanup is a DBA operation, requiring direct database superuser access
- See `docs/qa/demo-content.md` for the rationale
