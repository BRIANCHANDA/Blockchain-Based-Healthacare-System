// Run from backend: npm run db:status / db:migrate / db:baseline.
// Requires Node >=20.12. Never logs the connection string or patient data.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { sql as query } from 'drizzle-orm';
import { pushSchema, generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { withPostgresForeignKeyNames } from './pg-identifiers.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const envFile = path.join(root, '.env');
const fileEnv = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
if (process.env.DATABASE_URL && fileEnv.DATABASE_URL && process.env.DATABASE_URL !== fileEnv.DATABASE_URL) {
  throw new Error('DATABASE_URL differs between the shell and backend/.env. Resolve the target before continuing.');
}
const databaseUrl = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL;
if (!databaseUrl) throw new Error('Set DATABASE_URL in backend/.env or the environment. No local database fallback is allowed.');
const target = new URL(databaseUrl);
const command = process.argv[2] ?? 'status';
if (!['status', 'generate', 'migrate', 'baseline'].includes(command)) throw new Error('Use status, generate, migrate or baseline.');
console.log(`Database target: ${target.hostname}/${target.pathname.slice(1)} (${command})`);

if (command === 'generate') {
  const result = spawnSync(process.execPath, ['node_modules/drizzle-kit/bin.cjs', 'generate', ...process.argv.slice(3)], {
    cwd: root, env: { ...process.env, ...fileEnv, DATABASE_URL: databaseUrl }, stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

// Load the schema without starting the API, blockchain or email clients.
const filename = path.join(root, 'src/db/schema.ts');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const schema = {};
vm.runInNewContext(source, { exports: schema, require: createRequire(filename) });
const migrationsFolder = path.join(root, 'drizzle');
const migrations = readMigrationFiles({ migrationsFolder });
const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, 'meta/_journal.json'), 'utf8'));
const latest = journal.entries.at(-1);
const snapshot = JSON.parse(fs.readFileSync(path.join(migrationsFolder, `meta/${String(latest.idx).padStart(4, '0')}_snapshot.json`), 'utf8'));
const client = postgres(databaseUrl, { max: 1, connect_timeout: 15, idle_timeout: 5, onnotice: () => {} });
const db = drizzle(client);

async function history(tx) {
  const [row] = await tx.execute(query`select to_regclass('drizzle.__drizzle_migrations') as name`);
  if (!row.name) return [];
  return [...await tx.execute(query`select hash, created_at from drizzle.__drizzle_migrations order by created_at`)];
}

async function diff(tx) {
  // drizzle-kit expects a node-postgres-shaped result; our driver is postgres-js.
  return withPostgresForeignKeyNames(schema, () =>
    pushSchema(schema, { execute: async statement => ({ rows: await tx.execute(statement) }) }));
}

try {
  const localChanges = await generateMigration(snapshot, generateDrizzleJson(schema, snapshot.id));
  if (localChanges.length) throw new Error('Schema changes are missing a migration. Run db:generate and review the SQL first.');
  if (command === 'status') {
    await db.transaction(async tx => {
      const applied = await history(tx);
      const plan = await diff(tx);
      console.log(JSON.stringify({
        migrationHistory: applied,
        recordedMigrations: applied.length,
        repositoryMigrations: migrations.length,
        hasDataLoss: plan.hasDataLoss,
        warnings: plan.warnings,
        statements: plan.statementsToExecute,
      }, null, 2));
    }, { accessMode: 'read only' });
  } else if (command === 'baseline') {
    // Only adopt an already-current database previously managed by db:push.
    // This DOES NOT pretend old SQL ran; it records a verified schema checkpoint.
    await db.transaction(async tx => {
      await tx.execute(query`select pg_advisory_xact_lock(734210091)`);
      await tx.execute(query`set local lock_timeout = '10s'`);
      const applied = await history(tx);
      if (applied.length) throw new Error('Migration history already exists; use db:migrate instead.');
      const plan = await diff(tx);
      if (plan.statementsToExecute.length || plan.hasDataLoss) throw new Error('Schema drift exists. Apply and verify the reviewed schema changes before baselining.');
      await tx.execute(query`create schema if not exists drizzle`);
      await tx.execute(query`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`);
      for (const migration of migrations) {
        await tx.execute(query`insert into drizzle.__drizzle_migrations (hash, created_at) values (${migration.hash}, ${migration.folderMillis})`);
      }
      console.log(`Verified baseline recorded for ${migrations.length} migration checkpoints.`);
    });
  } else {
    const applied = await history(db);
    const [existing] = await db.execute(query`select count(*)::int as count from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`);
    if (!applied.length && existing.count) throw new Error('Existing tables have no migration history. Inspect db:status; baseline only after verifying schema parity.');
    if (!applied.length && !existing.count) throw new Error('Legacy migrations omit objects previously created by db:push. Bootstrap an empty database with db:push, verify db:status, then db:baseline.');
    for (const [index, row] of applied.entries()) {
      const migration = migrations[index];
      if (!migration || migration.folderMillis !== Number(row.created_at) || migration.hash !== row.hash) {
        throw new Error('Applied migration history differs from repository SQL. Stop and investigate.');
      }
    }
    if (applied.length === migrations.length) {
      console.log('No pending migrations; all migration hashes verified. Use db:status for a live schema comparison.');
    } else {
      await migrate(db, { migrationsFolder });
      const plan = await db.transaction(diff, { accessMode: 'read only' });
      if (plan.statementsToExecute.length) throw new Error('Migration execution completed, but schema drift remains. Run db:status and review.');
      console.log('Migrations complete; database schema matches the application.');
    }
  }
} catch (error) {
  console.error(`Database maintenance failed: ${String(error.message).replaceAll(databaseUrl, '[REDACTED]')}`);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
