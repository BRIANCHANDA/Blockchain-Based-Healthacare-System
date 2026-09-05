/**
 * MedLink API — application entry point.
 *
 * Composes every route module onto one Hono app and starts the Bun server.
 * Read this file to find out WHERE something lives; read the route module to
 * find out how it works.
 *
 * Order matters here. Middleware is applied before routers, so the sequence
 * below is also the order a request passes through:
 *
 *   logger      →  request line, for tracing a call through the logs
 *   cors        →  the web portal and the mobile app are separate origins
 *   rateLimit   →  applied globally; login has its own tighter limit
 *   routers     →  the mounted feature modules
 *   errorHandler→  last, so anything thrown anywhere lands in one place and
 *                  returns a shaped error instead of a stack trace
 *
 * Every router is mounted under /api. The OpenAPI document and the Scalar
 * reference UI are generated from the same zod schemas the routes validate
 * with, so the docs cannot drift from the implementation.
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { apiLimiter } from './middleware/rateLimit';
import { globalErrorHandler } from './lib/errors';
import { authRouter } from './routes/auth';
import { patientRouter } from './routes/patients';
import { practitionerRouter } from './routes/practitioners';
import { permissionRouter } from './routes/permissions';
import { auditRouter } from './routes/audit';
import { recordRouter } from './routes/records';
import { visitRouter } from './routes/visits';
import { institutionRouter } from './routes/institutions';
import { referralRouter } from './routes/referrals';
import { dashboardRouter } from './routes/receptionstats';
import { doctorStatsRouter } from './routes/doctor-stats';
import { labStatsRouter } from './routes/lab-stats';
import { radiologyStatsRouter } from './routes/radiology-stats';
import { adminStatsRouter } from './routes/admin-stats';
import { pharmacyStatsRouter } from './routes/pharmacy';
import { appointmentRouter } from './routes/appointments';
import { reportsRouter } from "./routes/reports";
import { personalReportRouter } from "./routes/personal-report";
import { stockRouter } from "./routes/stock";
import { wardRouter } from "./routes/wards";
import { notificationsRouter } from './routes/notifications';
import { adminBlockchainRouter } from './routes/blockchain';
import { filesRouter } from './routes/files';
import { aiRouter } from './routes/ai/ai';
import { labRouter } from './routes/lab';
import { medicalRouter } from './routes/medical';
import { guardiansRouter } from './routes/guardians';
import { securityRouter } from './routes/security';


const app = new OpenAPIHono();

// ── CORS — must be before all routes ─────────────────────────────────────────
/*
 * CORS.
 *
 * This previously reflected whatever Origin the caller sent, with credentials
 * enabled — which is to say any website could make authenticated requests to
 * this API on a signed-in user's behalf. In development that is convenient; in
 * production it is an open door.
 *
 * Behaviour now depends on the environment:
 *   development — any origin, so the web portal, Expo and a phone on the LAN
 *                 all work without configuration;
 *   production  — only the origins listed in CORS_ORIGINS (comma-separated).
 *
 * The mobile app is unaffected either way: native requests send no Origin
 * header, so CORS does not apply to them.
 */
const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.warn(
    '[cors] NODE_ENV=production but CORS_ORIGINS is empty — every browser ' +
    'origin will be refused. Set it to your web portal URL.',
  );
}

app.use('*', cors({
  origin: (origin) => {
    if (process.env.NODE_ENV !== 'production') return origin ?? '*';
    return allowedOrigins.includes(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Acting-As-Patient'],
  credentials: true,
}));

// ── Logger ────────────────────────────────────────────────────────────────────
app.use('*', logger());

// ── Global rate limit (DDoS backstop — 200 req/min per IP) ───────────────────
app.use('/api/*', apiLimiter);

/*
 * UPLOADED CLINICAL FILES ARE NOT SERVED STATICALLY.
 *
 * This used to be `app.use('/uploads/*', serveStatic({ root: './' }))`, which
 * handed any caller a patient's radiology images with no token and no consent
 * check — an anonymous GET returned a real X-ray. Filenames are obscure, but the
 * URLs travel inside API responses, so one leaked URL meant permanent access
 * that outlived both consent expiry and revocation.
 *
 * Files now go through /api/files, which resolves each one back to the patient
 * it belongs to, applies the same access rule as the rest of the system, and
 * writes the view to the audit trail. See routes/files.ts.
 */
app.route('/api/files', filesRouter);

// ── Global error handler ──────────────────────────────────────────────────────
app.onError(globalErrorHandler);

// ── Routes ────────────────────────────────────────────────────────────────────
app.route('/api/auth', authRouter);
app.route('/api/patients', patientRouter);
app.route('/api/practitioners', practitionerRouter);
app.route('/api/permissions', permissionRouter);
app.route('/api/audit', auditRouter);
app.route('/api/records', recordRouter);
app.route('/api/visits', visitRouter);
app.route('/api/institutions', institutionRouter);
app.route('/api/referrals', referralRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/doctor', doctorStatsRouter);
app.route('/api/lab-stats', labStatsRouter);
app.route('/api/radiology-stats', radiologyStatsRouter);
app.route('/api/dashboard/admin', adminStatsRouter);
app.route('/api/pharmacy-stats', pharmacyStatsRouter);
app.route('/api/appointments', appointmentRouter);
app.route('/api/reports', reportsRouter);
app.route('/api/reports/personal', personalReportRouter);
app.route('/api/stock', stockRouter);
app.route('/api/wards', wardRouter);
app.route('/api/notifications', notificationsRouter);
app.route('/api/ai', aiRouter);
app.route('/api/lab', labRouter);
app.route('/api/medical', medicalRouter);
app.route('/api/guardians', guardiansRouter);
app.route('/api/admin/blockchain', adminBlockchainRouter);
app.route('/api/security', securityRouter);
// ── OpenAPI docs ──────────────────────────────────────────────────────────────
const serverUrl = process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'HealthChain API',
    version: '1.0.0',
    description: `
## Blockchain-based Healthcare Information System
**Copperbelt University — Final Year Project**

### Patient Journey
1. **Registration** — Patient registers and gets a blockchain address
2. **Visit** — Nurse/Receptionist opens a visit
3. **Triage** — Nurse records vitals and nursing assessment
4. **Consultation** — Doctor examines and documents (SOAP notes)
5. **Lab** — Doctor orders tests, Lab Tech enters results
6. **Radiology** — Doctor orders imaging, Radiologist submits report
7. **Pharmacy** — Doctor prescribes, Pharmacist dispenses
8. **Discharge** — Doctor discharges with summary

Every write stores a hash on **Hyperledger Fabric** for tamper-proof audit.
    `,
  },
  servers: [{ url: serverUrl, description: 'API Server' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
});

app.get('/reference', apiReference({ theme: 'purple', spec: { url: '/doc' } }));

app.get('/', (c) => c.json({
  status: 'ok',
  message: 'HealthChain API — Copperbelt University',
  docs: `${serverUrl}/reference`,
}));

// ── Start ─────────────────────────────────────────────────────────────────────
const port = parseInt(process.env.PORT ?? '3000');
console.log(`HealthChain API running on port ${port}`);
console.log(`API Reference: ${serverUrl}/reference`);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 60,
};