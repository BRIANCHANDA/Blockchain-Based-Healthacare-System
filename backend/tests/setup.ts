/**
 * Test environment, preloaded before any module is imported (see bunfig.toml).
 *
 * Several modules read process.env at import time — services/crypto.ts derives
 * its key, db/index.ts opens its pool — so these values cannot be set from
 * inside a test file. They have to be in place before the first import.
 */

/**
 * A fixed key, so runs are reproducible and no production secret is needed.
 * Not a credential: it exists only to satisfy crypto.ts's 32-byte requirement.
 */
process.env.AES_SECRET_KEY ??= "test-key-please-do-not-use-in-prod-0123456789";

/** Same reasoning for token signing in the integration tests. */
process.env.JWT_SECRET ??= "test-jwt-secret-not-for-production";

/**
 * REDIRECT EVERY TEST AT A SEPARATE DATABASE.
 *
 * The integration tests insert, update and delete freely, so they must never
 * reach the development database. The default below points at healthcare_test;
 * override with TEST_DATABASE_URL if your setup differs.
 *
 * The guard afterwards is deliberate. A typo that left tests pointed at
 * healthcare_data would silently destroy the seeded data this project demos
 * from, so the suite refuses to start rather than risk it.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/healthcare_data")
    .replace(/\/healthcare_data(\b|$)/, "/healthcare_test");

const dbName = process.env.DATABASE_URL.split("/").pop()?.split("?")[0] ?? "";
if (!/test/i.test(dbName)) {
  throw new Error(
    `Refusing to run tests against "${dbName}" — the database name must contain "test". ` +
    `Set TEST_DATABASE_URL to a dedicated test database.`,
  );
}
