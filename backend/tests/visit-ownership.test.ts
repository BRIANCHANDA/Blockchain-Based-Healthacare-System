import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { clinicalWriteDenial } from '../src/lib/visit-ownership';
import { afterClinicalCommit, clinicalDb, createClinicalWriteGuard } from '../src/middleware/clinical-write';
import { practitioners } from '../src/db/schema';

const visitId = 'b9b7fd64-6ad2-4a12-9021-a2015bd283ad';
const doctor = { id: 'doctor-a', institutionId: 'hospital-a' };
const visit = { id: visitId, patientId: 'patient-a', status: 'in-progress', assignedDoctorId: doctor.id, institutionId: doctor.institutionId };

describe('clinical ownership policy', () => {
  test('only the assigned doctor can write an active visit', () => {
    expect(clinicalWriteDenial(visit, doctor)).toBeNull();
    expect(clinicalWriteDenial(visit, { ...doctor, id: 'doctor-b' })).not.toBeNull();
    expect(clinicalWriteDenial({ ...visit, assignedDoctorId: null }, doctor)).not.toBeNull();
  });
  test('handover revokes the sender and enables the receiver', () => {
    const transferred = { ...visit, assignedDoctorId: 'doctor-b' };
    expect(clinicalWriteDenial(transferred, doctor)).not.toBeNull();
    expect(clinicalWriteDenial(transferred, { ...doctor, id: 'doctor-b' })).toBeNull();
  });
  test('closed, scheduled and cross-hospital visits are read-only', () => {
    for (const status of ['scheduled', 'completed', 'cancelled'])
      expect(clinicalWriteDenial({ ...visit, status }, doctor)).not.toBeNull();
    expect(clinicalWriteDenial(visit, { ...doctor, institutionId: 'hospital-b' })).not.toBeNull();
    expect(clinicalWriteDenial({ ...visit, institutionId: null }, { ...doctor, institutionId: null })).not.toBeNull();
  });
});

function fixture(initial = { ...visit }, role = 'practitioner') {
  let current = { ...initial };
  let locks = 0, commits = 0, rollbacks = 0, writes = 0, notifications = 0;
  const database = {
    async transaction(callback: (tx: any) => Promise<void>) {
      const before = { ...current };
      const tx = { select: () => ({ from: (table: unknown) => ({ where: () => {
        if (table === practitioners) return Promise.resolve([doctor]);
        return { for: (mode: string) => { expect(mode).toBe('update'); locks++; return Promise.resolve([current]); } };
      } }) }) };
      try { await callback(tx); commits++; }
      catch (error) { current = before; rollbacks++; throw error; }
    },
  };
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('userId', doctor.id); c.set('userType', role); await next(); });
  app.use('/:visitId/*', createClinicalWriteGuard(database as any));
  app.post('/:visitId/:action', c => {
    expect(clinicalDb(c)).not.toBe(database);
    writes++;
    current.assignedDoctorId = 'doctor-b';
    afterClinicalCommit(c, () => { expect(commits).toBeGreaterThan(0); notifications++; });
    if (c.req.param('action') === 'fail') return c.json({ error: 'audit failed' }, 500);
    return c.json({ success: true });
  });
  return { app, stats: () => ({ locks, commits, rollbacks, writes, notifications, current }) };
}
describe('clinical write middleware', () => {
  test('does not turn nursing workflows into doctor-only actions', async () => {
    const f = fixture({ ...visit, assignedDoctorId: 'doctor-b' }, 'nurse');
    const res = await f.app.request(`/${visitId}/vitals`, { method: 'POST', body: '{}' });
    expect(res.status).toBe(200);
    expect(f.stats().writes).toBe(1);
  });
  test('commits handover before notifying and rejects a stale form afterward', async () => {
    const f = fixture();
    const request = (action: string) => f.app.request(`/${visitId}/${action}`, { method: 'POST', body: '{}' });
    expect((await request('handover')).status).toBe(200);
    expect(f.stats().notifications).toBe(1);
    expect((await request('consultation')).status).toBe(403);
    expect(f.stats().writes).toBe(1);
    expect(f.stats().locks).toBe(2);
  });
  test('failed writes roll back assignment and send no notification', async () => {
    const f = fixture();
    expect((await f.app.request(`/${visitId}/fail`, { method: 'POST', body: '{}' })).status).toBe(500);
    expect(f.stats().current.assignedDoctorId).toBe(doctor.id);
    expect(f.stats().rollbacks).toBe(1);
    expect(f.stats().notifications).toBe(0);
  });
  test('rejects a mismatched patient before reaching the handler', async () => {
    const f = fixture();
    const res = await f.app.request(`/${visitId}/handover`, { method: 'POST', body: JSON.stringify({ patientId: 'other-patient' }) });
    expect(res.status).toBe(403);
    expect(f.stats().writes).toBe(0);
  });
});
