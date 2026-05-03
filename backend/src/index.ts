import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun'; // ✅ Bun‑compatible static server

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

const app = new OpenAPIHono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// ✅ Serve uploaded radiology images from the 'uploads' folder at project root
//    A request to /uploads/radiology/abc.jpg will serve ./uploads/radiology/abc.jpg
app.use('/uploads/*', serveStatic({ root: './' }));

// API routes
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
// OpenAPI documentation
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'Healthcare Blockchain API',
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

Every step stores a hash on the **Hyperledger Fabric blockchain** for tamper-proof audit.
    `,
  },
  servers: [{ url: 'http://localhost:3000', description: 'Development' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
});

app.get('/reference', apiReference({
  theme: 'purple',
  spec: { url: '/doc' },
}));

app.get('/', (c) => c.json({
  status: 'ok',
  message: 'Healthcare Blockchain API',
  docs: 'http://localhost:3000/reference',
}));

const port = parseInt(process.env.PORT || '3000');
console.log(`Healthcare API running on http://localhost:${port}`);
console.log(`API Reference: http://localhost:${port}/reference`);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 60, // seconds — prevents Bun from killing slow blockchain queries
};