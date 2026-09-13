// Run: node --test --test-isolation=none tests/realtime.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/services/realtime.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const exports = {};
vm.runInNewContext(outputText, { exports, require: createRequire(import.meta.url) });
const { addConnection, notifyUser, notifyDataChanged, activeConnectionCount } = exports;

test('targeted notifications reach all recipient tabs, with one shared event ID', () => {
  const first = [], second = [], other = [];
  const cleanups = [
    addConnection('doctor', { write: s => first.push(s), close() {} }, 'hospital-a'),
    addConnection('doctor', { write: s => second.push(s), close() {} }, 'hospital-a'),
    addConnection('other', { write: s => other.push(s), close() {} }, 'hospital-b'),
  ];
  try {
    notifyUser('doctor', 'patient_assigned', { visitId: 'visit-1' });
    assert.equal(first.length, 1);
    assert.deepEqual(first, second);
    assert.equal(other.length, 0);
    const data = JSON.parse(first[0].split('data: ')[1]);
    assert.equal(data.visitId, 'visit-1');
    assert.ok(data.notificationId);
    assert.equal(activeConnectionCount(), 3);
  } finally { cleanups.forEach(fn => fn()); }
  assert.equal(activeConnectionCount(), 0);
});

test('invalidation is hospital-scoped and contains no clinical data', () => {
  const messages = [[], [], [], []];
  const cleanups = ['hospital-a', 'hospital-a', 'hospital-b', null].map((institution, i) =>
    addConnection(`user-${i}`, { write: s => messages[i].push(s), close() {} }, institution));
  try {
    notifyDataChanged('hospital-a', 'user-0');
    assert.deepEqual(messages.map(m => m.length), [1, 1, 0, 0]);
    assert.equal(messages[1][0], 'event: data_changed\ndata: {}\n\n');
    notifyDataChanged(null, 'user-3');
    assert.deepEqual(messages.map(m => m.length), [1, 1, 0, 1]);
    // An external referral can invalidate the destination and the sender.
    notifyDataChanged('hospital-b', 'user-0');
    assert.deepEqual(messages.map(m => m.length), [2, 1, 1, 1]);
  } finally { cleanups.forEach(fn => fn()); }
});

test('broken sockets are removed without preventing delivery to healthy sockets', () => {
  const healthy = [];
  let closed = 0;
  const broken = addConnection('doctor', {
    write() { throw new Error('disconnected'); },
    close() { closed++; throw new Error('already closed'); },
  }, 'hospital-a');
  const good = addConnection('doctor', { write: s => healthy.push(s), close() {} }, 'hospital-a');
  try {
    notifyUser('doctor', 'lab_result_ready', {});
    assert.equal(closed, 1);
    assert.equal(healthy.length, 1);
    assert.equal(activeConnectionCount(), 1);
    notifyDataChanged('hospital-a', 'doctor');
    assert.equal(healthy.length, 2);
  } finally { broken(); good(); }
  assert.equal(activeConnectionCount(), 0);
});
