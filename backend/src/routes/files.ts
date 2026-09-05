/**
 * Authenticated delivery of uploaded clinical files — radiology images and
 * laboratory attachments.
 *
 * WHY THIS EXISTS. These files were previously served by
 * `app.use('/uploads/*', serveStatic(...))`, which is to say to anybody who
 * could reach the server. An anonymous GET returned a real patient's X-ray with
 * no token and no consent check. The filenames are obscure, but obscurity is not
 * access control: the URLs travel inside API responses to every clinician who
 * views the record, so one leaked URL grants permanent, unauthenticated access —
 * surviving consent expiry and revocation alike. That is precisely the property
 * the consent model exists to prevent.
 *
 * Every request now resolves the file back to the patient it belongs to and
 * applies the same rule the rest of the system uses:
 *
 *   · the patient themselves may always see their own images;
 *   · a guardian acting for them may, via the X-Acting-As-Patient header;
 *   · staff may, if the patient has been seen at their institution;
 *   · nobody else, and never anonymously.
 *
 * A read is written to the audit trail, because looking at someone's scan is an
 * access to their record like any other.
 *
 * ON URL SHAPE. Browsers cannot attach an Authorization header to an <img> tag,
 * so the web portal fetches these as blobs. React Native's <Image> does support
 * headers, so the mobile app passes the token directly.
 */

import { z } from '@hono/zod-openapi';
import { and, eq, sql } from 'drizzle-orm';
import { createReadStream, existsSync, statSync } from 'fs';
import path from 'path';

import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { db } from '../db';
import {
  imagingReports, imagingOrders, labTestResults, labTestOrders,
  visits, patients, practitioners,
} from '../db/schema';
import { logAccess } from '../services/fabric';

/** Directories a file may be served from, mapped to their on-disk location. */
const CATEGORIES: Record<string, string> = {
  radiology: 'uploads/radiology',
  lab: 'uploads/lab',
};

/**
 * Content types we are willing to serve.
 *
 * An allowlist rather than a lookup: serving an arbitrary type from a directory
 * that accepts uploads is how a stored-XSS becomes possible, since a .html or
 * .svg file would execute in the viewer's origin.
 */
const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.dcm': 'application/dicom',
};

/**
 * Reject anything that is not a plain filename.
 *
 * The category and filename are concatenated into a path, so `../` traversal
 * would otherwise read arbitrary files off the server — including .env.
 */
function isSafeFilename(name: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(name) && !name.includes('..');
}

/**
 * Find which patient a stored file belongs to.
 *
 * The URL recorded against a report is absolute, so the filename is matched as a
 * suffix rather than compared whole — BASE_URL differs between environments and
 * a record anchored under one host must still resolve under another.
 */
async function resolveOwner(
  category: string,
  filename: string,
): Promise<{ patientId: string; recordId: string } | null> {
  if (category === 'radiology') {
    const [row] = await db
      .select({ patientId: visits.patientId, recordId: imagingReports.id })
      .from(imagingReports)
      .innerJoin(imagingOrders, eq(imagingReports.imagingOrderId, imagingOrders.id))
      .innerJoin(visits, eq(imagingOrders.visitId, visits.id))
      .where(sql`${imagingReports.imageUrls}::text LIKE ${'%' + filename + '%'}`)
      .limit(1);
    return row ?? null;
  }

  if (category === 'lab') {
    const [row] = await db
      .select({ patientId: visits.patientId, recordId: labTestResults.id })
      .from(labTestResults)
      .innerJoin(labTestOrders, eq(labTestResults.labTestOrderId, labTestOrders.id))
      .innerJoin(visits, eq(labTestOrders.visitId, visits.id))
      .where(sql`${labTestResults.attachmentUrls}::text LIKE ${'%' + filename + '%'}`)
      .limit(1);
    return row ?? null;
  }

  return null;
}

/** Decide whether this caller may see this patient's file. */
async function mayView(
  c: any,
  patientId: string,
): Promise<{ allowed: boolean; reason: string }> {
  const userId = c.get('userId');
  const userType = c.get('userType');

  // A patient always has access to their own records.
  if (userType === 'patient') {
    // A guardian operating on a dependent's behalf sends this header; the
    // middleware has already verified the link before setting it.
    const actingAs = c.req.header('X-Acting-As-Patient');
    const effective = actingAs || userId;
    return effective === patientId
      ? { allowed: true, reason: 'own record' }
      : { allowed: false, reason: 'not your record' };
  }

  // Staff: the patient must have been seen at their institution.
  const [staff] = await db
    .select({ institutionId: practitioners.institutionId })
    .from(practitioners)
    .where(eq(practitioners.id, userId))
    .limit(1);

  if (!staff?.institutionId) return { allowed: false, reason: 'no institution' };

  const [seenHere] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.patientId, patientId), eq(visits.institutionId, staff.institutionId)))
    .limit(1);

  return seenHere
    ? { allowed: true, reason: 'patient seen at this institution' }
    : { allowed: false, reason: 'patient not seen at your institution' };
}

export const filesRouter = createRouter()

  // ── GET /api/files/:category/:filename ──────────────────────────────────────
  .get('/:category/:filename', authMiddleware, async (c) => {
    const category = c.req.param('category');
    const filename = c.req.param('filename');

    const dir = CATEGORIES[category];
    if (!dir) {
      return c.json({ success: false, error: { message: 'Unknown file category' } }, 404);
    }
    if (!isSafeFilename(filename)) {
      return c.json({ success: false, error: { message: 'Invalid filename' } }, 400);
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) {
      return c.json({ success: false, error: { message: 'Unsupported file type' } }, 415);
    }

    const owner = await resolveOwner(category, filename);
    if (!owner) {
      // Either the file does not exist, or it is not referenced by any record.
      // An orphaned file has no patient to authorise against, so it is not served.
      return c.json({ success: false, error: { message: 'File not found' } }, 404);
    }

    const decision = await mayView(c, owner.patientId);
    if (!decision.allowed) {
      // Record the refusal: a denied attempt to view a scan is exactly the kind
      // of event an audit trail exists to capture.
      logAccess(owner.patientId, owner.recordId, `VIEW_${category.toUpperCase()}_DENIED`, false)
        .catch(() => { /* auditing must not block the response */ });
      return c.json({ success: false, error: { message: 'You do not have access to this file' } }, 403);
    }

    const filePath = path.join(process.cwd(), dir, filename);
    if (!existsSync(filePath)) {
      return c.json({ success: false, error: { message: 'File not found' } }, 404);
    }

    logAccess(owner.patientId, owner.recordId, `VIEW_${category.toUpperCase()}`, true)
      .catch(() => { /* non-blocking */ });

    const stat = statSync(filePath);
    const stream = createReadStream(filePath);

    return new Response(stream as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        // Private: this is one patient's clinical image. It must not be held by
        // a shared cache, and a browser cache should not outlive the session.
        'Cache-Control': 'private, no-store',
        // Defence in depth: even for an allowed type, never let the browser
        // decide to treat the bytes as something executable.
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  });
