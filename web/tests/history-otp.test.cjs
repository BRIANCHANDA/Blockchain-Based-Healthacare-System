const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source('lib/history-access.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exportsObject });
const { historyVisibility } = exportsObject;

test('history divisions retain actual hospital boundaries and legacy records', () => {
  const result = exportsObject.groupHistoryRecords([
    { visit: { institutionId: 'a' } }, { visit: { institutionId: 'b' } },
    { visit: { institutionId: 'a' } }, { visit: { institutionId: null } },
  ], { a: 'Hospital A', b: 'Hospital B' });
  assert.equal(result.length, 3);
  assert.equal(result[0].institutionName, 'Hospital A');
  assert.equal(result[0].visits.length, 2);
  assert.equal(result[1].institutionName, 'Hospital B');
  assert.equal(result[2].institutionName, 'Unspecified institution');
});

test('protected external records require consent without hiding home history', () => {
  const result = historyVisibility(false, [{ id: 'a', hasPermission: false }, { id: 'b', hasPermission: false }]);
  assert.equal(result.needsPatientConsent, true);
  assert.equal(result.accessibleInstitutions.length, 0);
});
test('patient-wide consent displays every authorized hospital', () => {
  const result = historyVisibility(true, [{ id: 'a', hasPermission: true }, { id: 'b', hasPermission: true }]);
  assert.equal(result.needsPatientConsent, false);
  assert.equal(result.accessibleInstitutions.length, 2);
  assert.equal(historyVisibility(false, []).needsPatientConsent, false);
});
test('a source-specific grant never opens another hospital', () => {
  const result = historyVisibility(false, [{ id: 'a', hasPermission: true }, { id: 'b', hasPermission: false }]);
  assert.equal(result.needsPatientConsent, true);
  assert.equal(result.accessibleInstitutions.length, 1);
  assert.equal(result.accessibleInstitutions[0].id, 'a');
});

test('no redundant request when every external institution is already accessible', () => {
  assert.equal(historyVisibility(false, [{ hasPermission: true }]).needsPatientConsent, false);
});

test('home cards use direct access and the request follows the home records', () => {
  const page = source('components/doctor/tabs/PatientHistoryTab.tsx');
  assert.match(page, /!directAccess && <div/);
  assert.match(page, /groupHistoryRecords\(ownVisits, institutionNames\)[\s\S]*?<AwayInstitutionSection\s+directAccess/);
  assert.ok(page.indexOf('{needsPatientConsent && historyRequest}') > page.indexOf('groupHistoryRecords(ownVisits, institutionNames)'));
  assert.doesNotMatch(page, /return historyRequest/);
});

// Exercise the real submit handler without mounting React or contacting auth.
function otpFixture(post) {
  const page = source('app/login/page.tsx');
  const handler = page.slice(page.indexOf('  const onSubmitOTP ='), page.indexOf('  const handleResend ='));
  const javascript = ts.transpileModule(handler + '\nexports.submit = onSubmitOTP;', {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const values = { loading: false, error: '', routes: [] };
  const context = {
    exports: {}, otpData: { userId: 'staff' }, otpInFlight: { current: false }, resending: false,
    setLoading: v => { values.loading = v; }, setError: v => { values.error = v; },
    api: { post }, setAuth: () => {},
    router: { replace: route => values.routes.push(route) }, ROLE_ROUTES: { practitioner: '/dashboard/doctor' },
  };
  vm.runInNewContext(javascript, context);
  return { submit: context.exports.submit, values, context };
}
test('auto-submit plus a click sends only one verification and stays disabled during navigation', async () => {
  let resolve, calls = 0;
  const pending = new Promise(r => { resolve = r; });
  const f = otpFixture(() => { calls++; return pending; });
  const first = f.submit({ otp: '123456' });
  await f.submit({ otp: '123456' });
  assert.equal(calls, 1);
  assert.equal(f.values.loading, true);
  resolve({ data: { data: { user: { type: 'practitioner' }, token: 'test-only' } } });
  await first;
  await f.submit({ otp: '123456' });
  assert.equal(calls, 1);
  assert.equal(f.values.loading, true);
  assert.equal(f.values.routes[0], '/dashboard/doctor');
});
test('verification failure releases the button for a corrected code', async () => {
  let calls = 0;
  const f = otpFixture(async () => { calls++; throw new Error('Invalid'); });
  await f.submit({ otp: '123456' });
  assert.equal(f.values.loading, false);
  assert.equal(f.context.otpInFlight.current, false);
  await f.submit({ otp: '654321' });
  assert.equal(calls, 2);
});
