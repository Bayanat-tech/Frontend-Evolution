const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');
const { JSDOM } = require('jsdom');

test('Revenue screen processes, verifies, saves settings and supports team review', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
  global.window = dom.window; global.document = dom.window.document;
  Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator });
  global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element;
  global.getComputedStyle = dom.window.getComputedStyle;
  global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { Simulate } = require('react-dom/test-utils');
  const { act } = React;
  const calls = [];
  let settings = { non_standard_base: null, rate_city: null, non_standard_kms: null, duqm_local_charge: null, duqm_frequency: null };
  let rows = [{
    waybill_id: 1, waybill_load_number: 'LOAD-1', destination_name: 'W1', scheduled_vehicle: 'T1', pickup_date: '15/09/2026', vendor_name: 'VENDOR', rig_id: 'R1',
    city: 'A', pickup_day: '2026-09-15', group_key: 'GROUP-1', drop_count: 1, trip_type: 'STANDARD',
    base_revenue: 100, kms_revenue: 70, kms_chargeable: 35, local_trip_revenue: 0, total_revenue: 170,
    status: 'READY', source_hash: 'HASH', issues: [], calculation: ['150 - 100 - 15 = 35 Kms'], processed: false, stale: false,
  }];
  global.__waybillTestApi = {
    getWaybillBilling: async () => ({ settings: { ...settings }, rows: rows.map((row) => ({ ...row })) }),
    processWaybillBilling: async () => { calls.push('process'); rows = rows.map((row) => ({ ...row, processed: true, review_token: 'TOKEN' })); return { count: rows.length, updated: rows.length }; },
    saveWaybillBillingSettings: async (value) => { calls.push(['settings', value]); settings = value; },
    reviewWaybillRevenue: async (id, payload) => { calls.push(['review', id, payload]); rows = rows.map((row) => row.waybill_id === id ? { ...row, status: payload.mode === 'manual' ? 'MANUAL_VERIFIED' : 'VERIFIED' } : row); },
  };
  const bundle = await build({
    stdin: { contents: 'export { WaybillRevenuePage } from "./src/pages/vendor/WaybillRevenuePage"; export { ToastProvider } from "./src/components/ui/AlertToast";', resolveDir: path.resolve(__dirname, '..'), loader: 'tsx' },
    bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'api-test-double', setup(build) {
      build.onResolve({ filter: /api\/vendor$/ }, () => ({ path: 'vendor', namespace: 'mock-api' }));
      build.onLoad({ filter: /.*/, namespace: 'mock-api' }, () => ({ contents: ['getWaybillBilling', 'processWaybillBilling', 'saveWaybillBillingSettings', 'reviewWaybillRevenue'].map((name) => `export const ${name} = (...args) => globalThis.__waybillTestApi.${name}(...args);`).join('\n'), loader: 'js' }));
      build.onResolve({ filter: /\.css$/ }, () => ({ path: 'empty-css', namespace: 'empty' }));
      build.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
    } }],
  });
  const compiled = new Module(path.join(__dirname, 'waybill-test-bundle.cjs'), module);
  compiled.filename = path.join(__dirname, 'waybill-test-bundle.cjs'); compiled.paths = module.paths;
  compiled._compile(bundle.outputFiles[0].text, compiled.filename);
  const { WaybillRevenuePage, ToastProvider } = compiled.exports;
  const root = createRoot(document.getElementById('root'));
  const button = (label) => [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === label);
  const click = async (label) => { assert.ok(button(label), `Missing button: ${label}`); await act(async () => button(label).click()); };
  try {
    await act(async () => root.render(React.createElement(ToastProvider, null, React.createElement(WaybillRevenuePage))));
    for (const label of ['Load Number', 'Destination Name', 'Scheduled Vehicle', 'Pickup Date', 'Vendor Name', 'Rig ID', 'Base Revenue', 'Kms Revenue', 'Trip Type', 'Kms chargeable']) {
      assert.ok(document.body.textContent.includes(label), `Missing Excel column ${label}`);
    }
    await click('Details / Review');
    assert.equal(button('Verify revenue').disabled, true);
    await click('Close');
    await click('Process all waybills');
    assert.ok(calls.includes('process'));
    await click('Details / Review');
    assert.equal(button('Verify revenue').disabled, false);
    await act(async () => Simulate.submit(button('Verify revenue').closest('form')));
    assert.equal(calls.at(-1)[2].mode, 'verify'); assert.equal(calls.at(-1)[2].review_token, 'TOKEN');
    assert.ok(document.body.textContent.includes('1 verified'));
    await click('Billing settings');
    const rateSelect = [...document.querySelectorAll('select')].find((node) => [...node.options].some((option) => option.value === 'PER_WAYBILL'));
    await act(async () => { rateSelect.value = 'PER_WAYBILL'; Simulate.change(rateSelect); });
    assert.equal(button('Process all waybills').disabled, true, 'Unsaved rules cannot be used for processing');
    await act(async () => Simulate.submit(button('Save billing settings').closest('form')));
    assert.equal(calls.at(-1)[1].non_standard_base, 'PER_WAYBILL');
    rows = [{ ...rows[0], status: 'NEEDS_REVIEW', base_revenue: null, kms_revenue: null, kms_chargeable: null, local_trip_revenue: null, total_revenue: null, issues: ['More than two drop points: team review required.'], drop_count: 3 }];
    await click('Refresh'); await click('Details / Review');
    assert.ok(document.body.textContent.includes('More than two drop points'));
    const form = button('Save team review').closest('form');
    assert.equal(form.querySelector('textarea').required, true);
    await act(async () => {
      for (const input of form.querySelectorAll('input[type="number"]')) { input.value = '0'; Simulate.change(input); }
      const note = form.querySelector('textarea'); note.value = 'Shared charges allocated to another row'; Simulate.change(note);
    });
    await act(async () => Simulate.submit(form));
    assert.equal(calls.at(-1)[2].mode, 'manual'); assert.equal(calls.at(-1)[2].review_note, 'Shared charges allocated to another row');
    for (const key of ['base_revenue', 'kms_revenue', 'kms_chargeable', 'local_trip_revenue']) assert.equal(calls.at(-1)[2][key], '0');
  } finally { await act(async () => root.unmount()); dom.window.close(); delete global.__waybillTestApi; }
});
