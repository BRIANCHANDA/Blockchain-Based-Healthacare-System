/**
 * Test preload — runs before any test file is imported.
 *
 * services/crypto.ts reads AES_SECRET_KEY at module load, so it has to be set
 * before the first import of that module. A fixed literal is used rather than
 * the real .env value so the suite is reproducible on any machine and in CI,
 * and so no production secret is ever needed to run the tests.
 */
process.env.AES_SECRET_KEY ??= "test-key-please-do-not-use-in-prod-0123456789";
