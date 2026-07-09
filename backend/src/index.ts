import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';

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
import { aiRouter } from './routes/ai/ai';
import { labRouter } from './routes/lab';
import { medicalRouter } from './routes/medical';
import { guardiansRouter } from './routes/guardians';
import { securityRouter } from './routes/security';


const app = new OpenAPIHono();

// ── CORS — must be before all routes ─────────────────────────────────────────
app.use('*', cors({
  origin: (_origin) => _origin ?? '*',   // allow all origins; tighten in production if needed
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Acting-As-Patient'],
  credentials: true,
}));

// ── Logger ────────────────────────────────────────────────────────────────────
app.use('*', logger());

// ── Global rate limit (DDoS backstop — 200 req/min per IP) ───────────────────
app.use('/api/*', apiLimiter);

// ── Static files (radiology uploads) ─────────────────────────────────────────
app.use('/uploads/*', serveStatic({ root: './' }));

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