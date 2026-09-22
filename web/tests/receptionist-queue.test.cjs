const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exported = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/receptionist-queue.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exported });
const now = Date.parse('2026-09-16T10:30:00Z');
const row = { id: 'visit', patientName: 'Fredrick Musonda', visitNumber: 'VIS-123',
  admissionDate: '2026-09-16T09:00:00Z', chiefComplaint: null, priority: 'routine', status: 'in-progress' };

test('queue page maps the API response before rendering', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/dashboard/receptionist/queue/page.tsx'), 'utf8');
  assert.match(source, /setQueue\(q\.map\(/);
  assert.ok(source.includes('receptionistQueueItem(row)'));
  assert.ok(source.includes('queueWaitLabel(item.waitMins)'));
});

test('actual receptionist API fields map to visible patient and visit details', () => {
  const result = exported.receptionistQueueItem(row, now);
  assert.equal(result.name, 'Fredrick Musonda');
  assert.equal(result.ticket, 'VIS-123');
  assert.equal(result.waitMins, 90);
  assert.equal(exported.queueWaitLabel(result.waitMins), '1h 30m');
});
test('missing or invalid admission time never renders undefined or NaN', () => {
  for (const admissionDate of [null, undefined, '', 'invalid']) {
    const result = exported.receptionistQueueItem({ ...row, admissionDate }, now);
    assert.equal(result.waitMins, null);
    assert.equal(exported.queueWaitLabel(result.waitMins), '—');
  }
  assert.equal(exported.queueWaitLabel(undefined), '—');
  assert.equal(exported.queueWaitLabel(NaN), '—');
  assert.equal(exported.queueWaitLabel(0), '0m');
});
test('future admissions clamp at zero and missing names have a safe fallback', () => {
  const result = exported.receptionistQueueItem({ ...row, patientName: '', admissionDate: '2026-09-17T09:00:00Z' }, now);
  assert.equal(result.waitMins, 0);
  assert.equal(result.name, 'Patient name unavailable');
});
