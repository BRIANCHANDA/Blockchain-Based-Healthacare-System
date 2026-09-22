const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name];
  } });
  return exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function authFixture() {
  const storage = new Map();
  const session = load('utils/session.ts', {});
  const { useAuthStore: store } = load('store/authStore.ts', {
    zustand: { create: init => {
      let state;
      const set = value => { state = { ...state, ...value }; };
      const get = () => state;
      state = init(set, get);
      return { getState: get, setState: set };
    } },
    '@react-native-async-storage/async-storage': {
      getItem: async key => storage.get(key) ?? null,
      setItem: async (key, value) => { storage.set(key, value); },
      removeItem: async key => { storage.delete(key); },
      multiRemove: async keys => { keys.forEach(key => storage.delete(key)); },
      multiSet: async pairs => { pairs.forEach(([key, value]) => storage.set(key, value)); },
    },
    '../utils/session': session,
    '../api/access': { unregisterPushToken: async () => { throw new Error('Expiry must not unregister'); } },
    '../utils/notifications': { getExpoPushToken: async () => null },
  });
  return { store, storage, session };
}

test('expiry immediately signs out and removes dependent context', async () => {
  const { store, storage, session } = authFixture();
  await store.getState().setAuth('old', { id: 'guardian' });
  await store.getState().setActivePatient('child', 'Child');
  const expired = session.expireSession('old');
  assert.equal(store.getState().isAuthenticated, false);
  assert.equal(store.getState().activePatientId, null);
  await expired;
  assert.equal(storage.size, 0);
});
test('old and concurrent 401 responses cannot erase a new login', async () => {
  const { store, storage, session } = authFixture();
  await store.getState().setAuth('old', { id: 'one' });
  const login = store.getState().setAuth('new', { id: 'two' });
  await Promise.all([login, session.expireSession('old'), session.expireSession('old')]);
  await session.expireSession('old');
  assert.equal(store.getState().token, 'new');
  assert.equal(storage.get('auth_token'), 'new');
});
test('new login and restart reset dependent context', async () => {
  const { store, storage } = authFixture();
  await store.getState().setAuth('one', { id: 'one' });
  await store.getState().setActivePatient('child', 'Child');
  await store.getState().setAuth('two', { id: 'two' });
  assert.equal(store.getState().activePatientId, null);
  assert.equal(storage.has('active_patient_id'), false);
  await store.getState().setActivePatient('other', 'Other');
  await store.getState().loadFromStorage();
  assert.equal(store.getState().activePatientId, null);
  assert.equal(storage.has('active_patient_id'), false);
});

// Small deterministic hook harness: no native services or real patient data.
function resourceFixture() {
  let auth = { token: 'session', activePatientId: 'a' };
  let index = 0, slots = [], effect, cleanup;
  const listeners = {};
  const subscribe = name => callback => {
    listeners[name] = callback;
    return { remove: () => { delete listeners[name]; } };
  };
  const store = selector => selector(auth);
  store.getState = () => auth;
  const react = {
    useState(initial) {
      const i = index++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) {
      const i = index++;
      if (!slots[i] || deps.some((v, j) => v !== slots[i].deps[j])) slots[i] = { fn, deps };
      return slots[i].fn;
    },
  };
  const { usePatientResource } = load('hooks/usePatientResource.ts', {
    react,
    'react-native': { AppState: { currentState: 'active', addEventListener: (_, cb) => subscribe('app')(cb) } },
    '@react-navigation/native': { useFocusEffect: fn => { if (effect !== fn) { cleanup?.(); effect = fn; cleanup = fn(); } } },
    'expo-notifications': {
      addNotificationReceivedListener: subscribe('push'),
      addNotificationResponseReceivedListener: subscribe('tap'),
    },
    '../store/authStore': { useAuthStore: store },
  });
  return {
    render(loader) { index = 0; return usePatientResource(loader, []); },
    switchPatient(id) { auth = { ...auth, activePatientId: id }; },
    listeners,
    unmount() { cleanup?.(); },
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('patient switch hides old records and rejects late responses', async () => {
  const f = resourceFixture(), a = deferred(), b = deferred();
  const loadA = () => a.promise, loadB = () => b.promise;
  f.render(loadA);
  f.switchPatient('b');
  assert.equal(f.render(loadB).data.length, 0);
  b.resolve(['B']); await settle();
  a.resolve(['A']); await settle();
  assert.equal(f.render(loadB).data[0], 'B');
  f.unmount();
});
test('refresh failure keeps previous data and exposes an error', async () => {
  const f = resourceFixture();
  let fail = false;
  const loader = async () => { if (fail) throw new Error('offline'); return ['request']; };
  f.render(loader); await settle();
  fail = true;
  await f.render(loader).refresh();
  const result = f.render(loader);
  assert.equal(result.error, true);
  assert.equal(result.data[0], 'request');
  assert.equal(result.refreshing, false);
  f.unmount();
});
test('foreground and notification events refresh and unsubscribe on blur', async () => {
  const f = resourceFixture();
  let calls = 0;
  const loader = async () => [++calls];
  f.render(loader); await settle();
  f.listeners.app('background'); f.listeners.app('active'); await settle();
  f.listeners.push(); await settle();
  f.listeners.tap(); await settle();
  assert.equal(calls, 4);
  f.unmount();
  assert.equal(Object.keys(f.listeners).length, 0);
});
test('a stale fetch cannot resurrect an approved request', async () => {
  const f = resourceFixture(), slow = deferred();
  let calls = 0;
  const loader = () => ++calls === 1 ? Promise.resolve(['request']) : slow.promise;
  f.render(loader); await settle();
  const result = f.render(loader);
  const refresh = result.refresh();
  result.update(() => []);
  slow.resolve(['request']); await refresh;
  assert.equal(f.render(loader).data.length, 0);
  f.unmount();
});
