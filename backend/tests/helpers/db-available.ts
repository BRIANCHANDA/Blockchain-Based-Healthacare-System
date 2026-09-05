/**
 * Detects whether a test database is reachable.
 *
 * The unit suites need no infrastructure; the integration suites need Postgres.
 * Without this check a developer or examiner running `bun test` with the
 * database stopped sees failures that look like broken code but are really a
 * missing prerequisite — which is exactly what happened during development,
 * more than once.
 *
 * A skipped suite states its reason; a failing one implies a defect. Those
 * should not be confused.
 */

import { sql } from "drizzle-orm";
import { db } from "../../src/db";

let cached: boolean | null = null;

export async function databaseAvailable(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    await db.execute(sql`select 1`);
    cached = true;
  } catch {
    console.warn(
      "\n[tests] Postgres is not reachable — skipping the integration suites.\n" +
      "        Start it with:  sudo systemctl start postgresql@18-main\n" +
      "        The unit suites do not need a database and still run.\n",
    );
    cached = false;
  }
  return cached;
}
