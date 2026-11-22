// Usage: npm run db:reset -- --database=<name> --yes-delete-all-data [--allow-production]
// DESTRUCTIVE: drops every table in the public schema, then re-runs all migrations
// so the database is empty. Run "npm run db:backup" or take a Render backup first.
// Afterwards run "npm run seed:admin" to create the first administrator.
import 'dotenv/config';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';
import { runMigrations } from '../database/run-migrations.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const dbArg = args.find((a) => a.startsWith('--database='))?.slice('--database='.length);

function stop(message) {
  console.error(`Refusing to reset: ${message}`);
  process.exitCode = 1;
}

try {
  const { rows } = await pool.query('SELECT current_database() AS db');
  const current = rows[0].db;
  const host = new URL(env.DATABASE_URL).hostname;

  if (!flag('--yes-delete-all-data')) {
    stop(`add --yes-delete-all-data to confirm. Target: database "${current}" on ${host}.`);
  } else if (dbArg !== current) {
    stop(`--database must exactly match the connected database name ("${current}" on ${host}).`);
  } else if (env.NODE_ENV === 'production' && !flag('--allow-production')) {
    stop('NODE_ENV is production; add --allow-production only if you really intend to wipe it.');
  } else {
    console.log(`Dropping all data in "${current}" on ${host} ...`);
    await pool.query('DROP SCHEMA public CASCADE');
    await pool.query('CREATE SCHEMA public');
    console.log('Re-running migrations ...');
    await runMigrations(pool);
    console.log('Done. Database is empty. Next: npm run seed:admin');
  }
} finally {
  await pool.end();
}
