// Usage: npm run check:env
// Verifies environment settings, the database connection and migration state.
// Prints no secrets. Exits 1 on any failure so it can be used in CI or a Render shell.
import 'dotenv/config';
import { readdir } from 'node:fs/promises';

const ok = (msg) => console.log(`  [ok]   ${msg}`);
const bad = (msg) => { console.error(`  [FAIL] ${msg}`); failed = true; };
let failed = false;

console.log('1. Environment settings');
let env, pool;
try {
  ({ env } = await import('../src/config/env.js'));
  ok('DATABASE_URL, JWT_SECRET, FRONTEND_ORIGIN and TRUST_PROXY are valid');
  if (env.NODE_ENV === 'production') ok('NODE_ENV=production');
  else console.log(`  [warn] NODE_ENV=${env.NODE_ENV} (set to production on Render)`);
} catch (e) {
  bad(e.message);
  process.exit(1);
}

console.log('2. Database connection');
try {
  ({ pool } = await import('../src/config/db.js'));
  const { rows } = await pool.query('SELECT current_database() AS db, current_user AS usr, version() AS v');
  const url = new URL(env.DATABASE_URL);
  ok(`connected to "${rows[0].db}" as "${rows[0].usr}" on host ${url.hostname}`);
  ok(rows[0].v.split(',')[0]);
} catch (e) {
  bad(`cannot connect: ${e.message}`);
  process.exit(1);
}

try {
  console.log('3. Migrations');
  const files = (await readdir(new URL('../database/migrations/', import.meta.url))).filter((n) => n.endsWith('.sql'));
  const exists = await pool.query("SELECT to_regclass('public.schema_migrations') AS t");
  if (!exists.rows[0].t) {
    bad('schema_migrations table missing - run "npm run migrate"');
  } else {
    const applied = await pool.query('SELECT count(*)::int AS n FROM schema_migrations');
    if (applied.rows[0].n === files.length) ok(`all ${files.length} migrations applied`);
    else bad(`${applied.rows[0].n} of ${files.length} migrations applied - run "npm run migrate"`);

    console.log('4. Data state');
    const users = await pool.query('SELECT count(*)::int AS n FROM users');
    const admins = await pool.query("SELECT count(*)::int AS n FROM users WHERE role='admin'");
    const demo = await pool.query("SELECT 1 FROM academic_years WHERE id='d36a2026-1102-4000-8000-000000000001'");
    ok(`${users.rows[0].n} user(s), ${admins.rows[0].n} admin(s)`);
    if (!admins.rows[0].n) console.log('  [warn] no admin yet - run "npm run seed:admin"');
    if (demo.rowCount) console.log('  [warn] demonstration data is loaded in this database');
    else ok('no demonstration data found');
  }
} catch (e) {
  bad(`check failed: ${e.message}`);
} finally {
  await pool.end();
}

console.log(failed ? '\nResult: FAILED' : '\nResult: all checks passed');
process.exit(failed ? 1 : 0);
