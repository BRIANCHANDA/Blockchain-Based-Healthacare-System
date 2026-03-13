import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRouter } from './routes/auth';
import { patientRouter } from './routes/patients';
import { practitionerRouter } from './routes/practitioners';
import { permissionRouter } from './routes/permissions';
import { auditRouter } from './routes/audit';
import { recordRouter } from './routes/records';
import { visitRouter } from './routes/visits';
import { institutionRouter } from './routes/institutions';
import { referralRouter } from './routes/referrals';
import { dashboardRouter } from "./routes/receptionstats";

const app = new OpenAPIHono();

app.use('*', cors());
app.use('*', logger());

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

export default { port, fetch: app.fetch };
