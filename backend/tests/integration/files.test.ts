/**
 * Integration tests for /api/files — authenticated delivery of clinical images.
 *
 *   bun test
 *
 * These exist because the route they replaced was a genuine breach. Radiology
 * images were served by `serveStatic` at /uploads, so an anonymous GET returned
 * a patient's X-ray in full. The filenames are obscure, but the URLs travel
 * inside API responses to every clinician who opens the record — so a single
 * leaked URL granted permanent access that outlived both consent expiry and
 * revocation.
 *
 * The tests below therefore assert refusals more carefully than successes: what
 * matters is that the bytes do not come back to someone who should not have
 * them.
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";

import { api } from "../helpers/api";
import { databaseAvailable } from "../helpers/db-available";
import { seedWorld, type World } from "../helpers/fixtures";

const dbUp = await databaseAvailable();

let world: World;
beforeAll(async () => { if (dbUp) world = await seedWorld(); });
afterAll(async () => { if (world) await world.cleanup(); });

/** A filename shaped like a real upload, belonging to nobody in particular. */
const UNOWNED = "1775386278116-09eff72748c10533.jpeg";

// ── the breach that prompted this route ──────────────────────────────────────

describe.skipIf(!dbUp)("the old public path is gone", () => {
  test("GET /uploads/... no longer serves anything", async () => {
    // The exact shape that used to return a patient's scan to anyone.
    const res = await api.get(`/uploads/radiology/${UNOWNED}`);
    expect(res.status).toBe(404);
  });
});

// ── authentication ───────────────────────────────────────────────────────────

describe.skipIf(!dbUp)("authentication", () => {
  test("an anonymous request is refused", async () => {
    const res = await api.get(`/api/files/radiology/${UNOWNED}`);
    expect([401, 403]).toContain(res.status);
  });

  test("a malformed token is refused", async () => {
    const res = await api.get(`/api/files/radiology/${UNOWNED}`, "not-a-jwt");
    expect([401, 403]).toContain(res.status);
  });

  test("no file bytes accompany a refusal", async () => {
    // A refusal that still leaked the image would defeat the whole exercise.
    const res = await api.get(`/api/files/radiology/${UNOWNED}`);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("JFIF");   // JPEG marker
    expect(body).not.toContain("�PNG");
    expect(res.body?.success).toBe(false);
  });
});

// ── path traversal ───────────────────────────────────────────────────────────

describe.skipIf(!dbUp)("path traversal", () => {
  test("cannot escape the upload directory", async () => {
    // The category and filename are joined into a path, so traversal would
    // otherwise read arbitrary server files — .env among them.
    for (const attempt of [
      "..%2F..%2F.env",
      "....//....//.env",
      "..%252F..%252F.env",
      "%2e%2e%2f.env",
    ]) {
      const res = await api.get(`/api/files/radiology/${attempt}`);
      expect(res.status).not.toBe(200);
      expect(JSON.stringify(res.body)).not.toContain("DATABASE_URL");
      expect(JSON.stringify(res.body)).not.toContain("JWT_SECRET");
    }
  });

  test("an unknown category is refused", async () => {
    const res = await api.get("/api/files/../../etc/passwd");
    expect(res.status).not.toBe(200);
  });
});

// ── file type handling ───────────────────────────────────────────────────────

describe.skipIf(!dbUp)("file types", () => {
  test("an executable or markup extension is never served", async () => {
    // Serving .html or .svg from a directory that accepts uploads turns an
    // upload into stored XSS in the viewer's origin.
    for (const name of ["evil.html", "evil.svg", "evil.js", "shell.sh"]) {
      const res = await api.get(`/api/files/radiology/${name}`);
      expect(res.status).not.toBe(200);
    }
  });
});

// ── request size ─────────────────────────────────────────────────────────────

describe.skipIf(!dbUp)("request size limit", () => {
  test("an oversized JSON body is refused with 413, not processed", async () => {
    // Roughly 120 request fields have no maximum length. One limit at the edge
    // caps the whole class rather than relying on 120 individual bounds.
    const huge = "x".repeat(600 * 1024);
    const res = await api.post("/api/auth/login/staff", {
      licenseNumber: huge,
      password: "x",
    });
    expect(res.status).toBe(413);
  });

  test("an ordinary body still passes", async () => {
    const res = await api.post("/api/auth/login/staff", {
      licenseNumber: "DOC-does-not-exist",
      password: "whatever",
    });
    expect(res.status).not.toBe(413);
  });
});
