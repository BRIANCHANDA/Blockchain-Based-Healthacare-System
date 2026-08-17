// backend/src/scripts/verify-reports.ts
//
// Exercises every reporting module for every role, in both JSON and PDF form,
// against whatever data the database currently holds.
//
// For each role it checks:
//   - the JSON report returns 200 and carries the role's own metrics
//   - the PDF renders, is a valid PDF, and has real pages
//   - the rendered text contains no placeholder leakage ("undefined", "NaN",
//     "None", "[object Object]") — the usual tell of an unhandled field
//
// Admin and super admin additionally get the three institutional reports.
// PDFs are written to /tmp for eyeballing.
//
//   bun run src/scripts/verify-reports.ts

import { sign } from 'jsonwebtoken';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { and, eq, isNull, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { authSessions, practitioners } from '../db/schema';

const API = process.env.API_URL ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'healthcare_jwt_secret';
const OUT_DIR = process.env.REPORT_OUT_DIR ?? path.join(os.tmpdir(), 'healthchain-reports');

let passed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`    PASS  ${label}`); }
  else { failures.push(label); console.log(`    FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}

const tag = Date.now();
const issuedTokens: string[] = [];

async function sessionFor(userId: string, userType: string) {
  const token = sign({ userId, userType, blockchainAddress: 'x' }, JWT_SECRET, { expiresIn: '30m' });
  await db.insert(authSessions).values({
    userId, userType: userType as any, jwtToken: token,
    refreshToken: `reportcheck-${tag}-${issuedTokens.length}`,
    expiresAt: new Date(Date.now() + 30 * 60_000), isActive: true,
  });
  issuedTokens.push(token);
  return token;
}

// Text that should never survive into a finished report.
const LEAKS = ['undefined', 'NaN', '[object Object]', 'null null', 'Invalid Date'];

function inspectPdf(buf: Buffer, file: string) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const full = path.join(OUT_DIR, file);
  fs.writeFileSync(full, buf);

  const isPdf = buf.subarray(0, 5).toString() === '%PDF-';
  let pages = 0;
  let text = '';
  try {
    const info = execFileSync('pdfinfo', [full], { encoding: 'utf8' });
    pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
    text = execFileSync('pdftotext', ['-q', full, '-'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch { /* reported by the caller's checks */ }
  return { isPdf, pages, text, full, bytes: buf.length };
}

async function getJson(token: string, url: string) {
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json().catch(() => ({})) as any };
}

async function getPdf(token: string, url: string) {
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buf, contentType: res.headers.get('content-type') ?? '' };
}

function checkReportPdf(
  label: string,
  r: { status: number; buf: Buffer; contentType: string },
  file: string,
  mustContain: string[] = [],
) {
  check(`${label}: PDF responded 200`, r.status === 200, `status ${r.status} — ${r.buf.subarray(0, 160).toString()}`);
  if (r.status !== 200) return;

  const pdf = inspectPdf(r.buf, file);
  check(`${label}: content-type is application/pdf`, r.contentType.includes('application/pdf'), r.contentType);
  check(`${label}: body is a real PDF`, pdf.isPdf);
  check(`${label}: has at least one page`, pdf.pages >= 1, `pages=${pdf.pages}`);
  check(`${label}: renders extractable text`, pdf.text.trim().length > 200, `${pdf.text.trim().length} chars`);

  const leaked = LEAKS.filter((tok) => pdf.text.includes(tok));
  check(`${label}: no placeholder leakage in the rendered text`, leaked.length === 0, `found ${JSON.stringify(leaked)}`);

  // One product name across the whole document set. Mixed branding on a
  // deliverable reads as unfinished.
  check(`${label}: branded MedLink`, /MedLink/i.test(pdf.text));
  check(`${label}: no legacy "HealthChain" branding`, !/HealthChain/i.test(pdf.text));
  check(`${label}: marked confidential`, /CONFIDENTIAL/i.test(pdf.text));
  check(`${label}: states the reporting period`, /Reporting Period/i.test(pdf.text));

  for (const frag of mustContain) {
    check(`${label}: report body includes "${frag}"`, pdf.text.toLowerCase().includes(frag.toLowerCase()),
      pdf.text.replace(/\s+/g, ' ').slice(0, 200));
  }
  console.log(`          ${pdf.pages}pp, ${(pdf.bytes / 1024).toFixed(0)}KB → ${pdf.full}`);
}

// role → summary keys its personal report must actually carry. These are the
// real field names the builders emit, so a renamed/dropped metric fails loudly.
const ROLE_EXPECTATIONS: Record<string, string[]> = {
  practitioner:   ['consultations', 'diagnosesMade', 'labOrdersPlaced', 'prescriptionsWritten'],
  nurse:          ['vitalsRecorded', 'distinctPatients'],
  lab_technician: ['testsResulted', 'pendingAssigned'],
  radiologist:    ['reportsCompleted', 'pendingAssigned'],
  pharmacist:     ['itemsDispensed', 'prescriptionsDispensed'],
  receptionist:   ['visitsCreated', 'appointmentsCreated', 'walkinVisits'],
  admin:          ['staffActive', 'patientsRegistered', 'visitsRecorded', 'emergencyOverrides'],
};

// The section heading each role's PDF must render, and the job title on its cover.
const ROLE_SECTIONS: Record<string, string> = {
  practitioner:   'Clinical Activity',
  nurse:          'Nursing Activity',
  lab_technician: 'Laboratory Activity',
  radiologist:    'Radiology Activity',
  pharmacist:     'Pharmacy Activity',
  receptionist:   'Reception Activity',
  admin:          'Institution Oversight',
};
const ROLE_TITLES: Record<string, string> = {
  practitioner:   'Physician',
  nurse:          'Nurse',
  lab_technician: 'Lab Technician',
  radiologist:    'Radiologist',
  pharmacist:     'Pharmacist',
  receptionist:   'Receptionist',
  admin:          'Administrator',
};

async function main() {
  const roles = ['practitioner', 'nurse', 'lab_technician', 'radiologist', 'pharmacist', 'receptionist', 'admin'];

  console.log(`PDFs → ${OUT_DIR}\n`);

  // ── Personal report, one per role ───────────────────────────────────────
  for (const role of roles) {
    const [staff] = await db.select({ id: practitioners.id })
      .from(practitioners)
      .where(and(eq(practitioners.role, role as any), eq(practitioners.isActive, true), isNotNull(practitioners.institutionId)))
      .limit(1);

    console.log(`\n── ${role} — personal report ──`);
    if (!staff) { check(`${role}: a user exists to test with`, false, 'no active staff with this role'); continue; }

    const token = await sessionFor(staff.id, role);

    const json = await getJson(token, '/api/reports/personal?format=json');
    check(`${role}: JSON responded 200`, json.status === 200, `status ${json.status} ${JSON.stringify(json.body).slice(0, 200)}`);
    if (json.status === 200) {
      const d = json.body?.data ?? {};
      check(`${role}: report is typed 'personal'`, d.reportType === 'personal', `got ${d.reportType}`);
      check(`${role}: names the staff member`, typeof d.staffName === 'string' && d.staffName.length > 1 && !d.staffName.includes('undefined'), `staffName=${d.staffName}`);
      check(`${role}: reports the role`, d.role === role, `got ${d.role}`);
      check(`${role}: carries a period`, !!d.period?.from && !!d.period?.to);
      const keys = Object.keys(d.summary ?? {});
      check(`${role}: has a non-empty summary`, keys.length > 0, `summary keys: ${JSON.stringify(keys)}`);
      const summary = d.summary ?? {};
      for (const e of ROLE_EXPECTATIONS[role] ?? []) {
        check(
          `${role}: summary reports "${e}"`,
          Object.prototype.hasOwnProperty.call(summary, e) && typeof summary[e] === 'number' && Number.isFinite(summary[e]),
          `summary=${JSON.stringify(summary).slice(0, 220)}`,
        );
      }
    }

    const pdf = await getPdf(token, '/api/reports/personal?format=pdf');
    // Each role's report must actually render its own section, not just a cover.
    checkReportPdf(role, pdf, `personal-${role}.pdf`, [
      'Performance Summary',
      ROLE_SECTIONS[role],
      ROLE_TITLES[role],
    ]);
  }

  // ── Institutional reports: hospital admin and super admin ───────────────
  for (const [label, where] of [
    ['hospital admin', and(eq(practitioners.role, 'admin' as any), isNotNull(practitioners.institutionId))],
    ['super admin', and(eq(practitioners.role, 'admin' as any), isNull(practitioners.institutionId))],
  ] as const) {
    const [admin] = await db.select({ id: practitioners.id }).from(practitioners).where(where).limit(1);
    console.log(`\n── ${label} — institutional reports ──`);
    if (!admin) { check(`${label}: a user exists to test with`, false, 'none found'); continue; }

    const token = await sessionFor(admin.id, 'admin');
    const slug = label.replace(/\s+/g, '-');

    for (const kind of ['clinical', 'operational', 'administrative']) {
      const json = await getJson(token, `/api/reports/${kind}?format=json`);
      check(`${label}/${kind}: JSON responded 200`, json.status === 200, `status ${json.status} ${JSON.stringify(json.body).slice(0, 160)}`);
      if (json.status === 200) {
        const d = json.body?.data ?? {};
        check(`${label}/${kind}: typed '${kind}'`, d.reportType === kind, `got ${d.reportType}`);
        check(`${label}/${kind}: names the institution scope`, typeof d.institutionName === 'string' && d.institutionName.length > 0, `got ${d.institutionName}`);
      }
      const pdf = await getPdf(token, `/api/reports/${kind}?format=pdf`);
      checkReportPdf(`${label}/${kind}`, pdf, `${slug}-${kind}.pdf`);
    }
  }

  // ── A report over a window that actually contains data ──────────────────
  // Everything above proves the reports are structurally sound. This proves
  // they carry real numbers — an empty report renders identically to a broken
  // one, so without this the suite could pass on a silently dead query.
  console.log('\n── populated window (data-bearing report) ──');
  const [busiest] = await db.execute(sql`
      SELECT practitioner_id AS id, COUNT(*)::int AS cnt
      FROM consultations GROUP BY practitioner_id ORDER BY cnt DESC LIMIT 1
  `) as any[];

  if (!busiest?.id) {
    console.log('    (skipped — no consultations in the database)');
  } else {
    const token = await sessionFor(busiest.id, 'practitioner');
    const range = 'from=2020-01-01&to=2030-12-31';
    const json = await getJson(token, `/api/reports/personal?${range}&format=json`);
    check('populated: JSON responded 200', json.status === 200, `status ${json.status}`);
    const s = json.body?.data?.summary ?? {};
    check(
      'populated: consultations are counted, not zero',
      (s.consultations ?? 0) >= Number(busiest.cnt),
      `expected >= ${busiest.cnt}, got ${s.consultations}`,
    );

    const pdf = await getPdf(token, `/api/reports/personal?${range}&format=pdf`);
    checkReportPdf('populated', pdf, 'personal-practitioner-populated.pdf', ['Clinical Activity']);
    if (pdf.status === 200) {
      const text = execFileSync('pdftotext', ['-q', path.join(OUT_DIR, 'personal-practitioner-populated.pdf'), '-'], { encoding: 'utf8' });
      check('populated: the PDF prints a non-zero consultation count', /\b[1-9]\d*\b/.test(text.split('Clinical Activity')[1] ?? ''), 'no non-zero figure after "Clinical Activity"');
      check('populated: renders a Top Diagnoses or Recent Consultations section',
        /Top Diagnoses|Recent Consultations/.test(text));
    }
  }

  console.log(
    failures.length
      ? `\n${failures.length} CHECK(S) FAILED:\n  - ${failures.join('\n  - ')}`
      : `\nALL CHECKS PASSED (${passed} passed)`,
  );
  if (failures.length) process.exitCode = 1;
}

async function cleanup() {
  for (const t of issuedTokens) {
    await db.delete(authSessions).where(eq(authSessions.jwtToken, t)).catch(() => {});
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => {
    await cleanup().catch(() => {});
    process.exit(process.exitCode ?? 0);
  });
