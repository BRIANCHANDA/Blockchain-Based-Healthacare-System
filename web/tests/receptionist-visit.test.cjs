const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/patient-display.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsObject });

test('patient name includes available names and handles missing fields', () => {
  const name = exportsObject.patientDisplayName;
  assert.equal(name({ firstName: ' Fredrick ', middleName: null, lastName: 'Musonda' }), 'Fredrick Musonda');
  assert.equal(name({ firstName: 'Jane', middleName: 'Mary', lastName: 'Doe' }), 'Jane Mary Doe');
  assert.equal(name({ lastName: 'Musonda' }), 'Musonda');
  assert.equal(name(null), 'Patient name unavailable');
  assert.equal(name({ firstName: ' ' }), 'Patient name unavailable');
});

test('Continue uses the existing receptionist visit-details route', () => {
  const source = fs.readFileSync(path.join(root, 'app/dashboard/receptionist/queue/page.tsx'), 'utf8');
  const button = source.slice(source.indexOf('{isActive && ('), source.indexOf('{isDone && ('));
  assert.match(button, /router\.push\(`\/dashboard\/receptionist\/visits\/\$\{item\.id\}`\)/);
  assert.ok(fs.existsSync(path.join(root, 'app/dashboard/receptionist/visits/[id]/page.tsx')));
  assert.ok(!source.includes('`/dashboard/visits/'));
});

test('queue identifies the patient by name without a reason placeholder', () => {
  const source = fs.readFileSync(path.join(root, 'app/dashboard/receptionist/queue/page.tsx'), 'utf8');
  assert.ok(source.includes('{item.name}'));
  assert.ok(!source.includes('No reason recorded'));
  assert.ok(!source.includes('{item.reason ||'));
});
