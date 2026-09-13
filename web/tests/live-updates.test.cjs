// No browser/server required: node --test --test-isolation=none tests/live-updates.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createStore } = require('zustand/vanilla');
const tick = () => new Promise(resolve => setImmediate(resolve));

function loadTs(file, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, require: name => mocks[name] ?? require(name), process, crypto: require('node:crypto'),
    ...globals,
  }, { filename: file });
  return exports;
}

test('all notification types have titles and correct destination routes', () => {
  const { notificationRoute: route, NOTIFICATION_EVENTS, notificationTitles } = loadTs('lib/notificationMeta.ts');
  NOTIFICATION_EVENTS.forEach(event => assert.ok(notificationTitles[event]));
  for (const role of ['admin', 'receptionist', 'practitioner']) {
    const portal = role === 'practitioner' ? 'doctor' : role;
    assert.equal(route('external_referral_received', {}, role), `/dashboard/${portal}/referrals/incoming`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', `app/dashboard/${portal}/referrals/incoming/page.tsx`)));
  }
  assert.equal(route('internal_referral_received', {}), '/dashboard/doctor/referrals');
  assert.equal(route('patient_assigned', { assignedRole: 'nurse', visitId: 'abc' }), '/dashboard/nurse/triage/abc');
  assert.equal(route('patient_assigned', { assignedRole: 'nurse' }), '/dashboard/nurse/queue');
  for (const event of ['patient_assigned', 'lab_result_ready', 'imaging_result_ready']) {
    assert.equal(route(event, { visitId: 'abc' }), '/dashboard/doctor/visit/abc');
  }
  assert.equal(route('patient_admitted', {}), '/dashboard/nurse/ward');
  assert.equal(route('lab_result_ready', {}), undefined);
});

test('mutation bursts are debounced into a single data refresh', () => {
  const window = new EventTarget();
  let timer, delay, events = 0;
  const { requestDataRefresh, DATA_CHANGED } = loadTs('lib/liveUpdates.ts', {}, {
    window, Event, setTimeout: (fn, ms) => { timer = fn; delay = ms; return 1; },
  });
  window.addEventListener(DATA_CHANGED, () => events++);
  requestDataRefresh(); requestDataRefresh(); requestDataRefresh();
  assert.equal(delay, 350);
  assert.equal(events, 0);
  timer();
  assert.equal(events, 1);
  requestDataRefresh(); timer();
  assert.equal(events, 2);
});

test('live refresh handles events, focus, offline recovery, fallback and cleanup without overlapping requests', async () => {
  const window = new EventTarget(), document = new EventTarget();
  document.visibilityState = 'visible';
  const effects = [];
  let interval, period, cleared = false, calls = 0, finish;
  const hook = loadTs('hooks/useLiveRefresh.ts', {
    react: { useEffect: fn => effects.push(fn), useRef: value => ({ current: value }) },
    '@/lib/liveUpdates': { DATA_CHANGED: 'changed' },
  }, {
    window, document,
    setInterval: (fn, ms) => { interval = fn; period = ms; return 7; },
    clearInterval: id => { assert.equal(id, 7); cleared = true; },
  });
  hook.useLiveRefresh(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  effects[0]();
  const cleanup = effects[1]();
  assert.equal(period, 30000);
  window.dispatchEvent(new Event('changed'));
  window.dispatchEvent(new Event('changed'));
  window.dispatchEvent(new Event('focus'));
  assert.equal(calls, 1);
  finish(); await tick();
  assert.equal(calls, 2); // many events while busy queue just one follow-up
  finish(); await tick();
  document.visibilityState = 'hidden';
  interval();
  assert.equal(calls, 2);
  document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(calls, 3);
  finish(); await tick();
  window.dispatchEvent(new Event('online'));
  assert.equal(calls, 4);
  cleanup();
  finish(); await tick();
  window.dispatchEvent(new Event('changed'));
  interval();
  assert.equal(calls, 4);
  assert.equal(cleared, true);
});

test('one stream feeds a shared inbox; malformed/duplicate events and logout are safe', () => {
  const effects = [], streams = [];
  let refreshes = 0;
  const auth = { user: { id: 'doctor' }, token: 'test-token' };
  class FakeEventSource extends EventTarget {
    constructor(url) { super(); this.url = url; streams.push(this); }
    close() { this.closed = true; }
    receive(event, data) { const message = new Event(event); message.data = data; this.dispatchEvent(message); }
  }
  const meta = loadTs('lib/notificationMeta.ts');
  const hook = loadTs('hooks/useNotification.ts', {
    react: { useEffect: fn => effects.push(fn) },
    zustand: { create: initial => { const store = createStore(initial); return Object.assign(() => store.getState(), store); } },
    '@/lib/store': { useAuthStore: selector => selector(auth) },
    '@/lib/notificationMeta': meta,
    '@/lib/liveUpdates': { requestDataRefresh: () => refreshes++ },
  }, { EventSource: FakeEventSource });
  hook.useNotificationStream();
  const cleanup = effects[0]();
  assert.equal(streams.length, 1);
  const stream = streams[0];
  stream.receive('connected'); stream.receive('data_changed');
  assert.equal(refreshes, 2);
  stream.receive('patient_assigned', '{invalid');
  stream.receive('patient_assigned', 'null');
  stream.receive('patient_assigned', '[]');
  assert.equal(hook.useNotifications().unreadCount, 0);
  const data = JSON.stringify({ notificationId: 'one', visitId: 'visit' });
  stream.receive('patient_assigned', data);
  stream.receive('patient_assigned', data);
  assert.equal(hook.useNotifications().notifications.length, 1);
  assert.equal(hook.useNotifications().unreadCount, 1);
  hook.useNotifications().dismiss('one');
  assert.equal(hook.useNotifications().unreadCount, 1); // dismissing a popup doesn't discard the inbox entry
  hook.useNotifications().markRead('one');
  assert.equal(hook.useNotifications().unreadCount, 0);
  auth.user = { id: 'someone-else' };
  assert.equal(hook.useNotifications().notifications.length, 0); // hidden before effect cleanup
  cleanup();
  assert.equal(stream.closed, true);
});
