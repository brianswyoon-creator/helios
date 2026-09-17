// Verifies the site's calculations against the values cached in the real Google Sheet export.
// Run with the workbook path:  SHEET_XLSX=path/to/export.xlsx npm test   (skipped when absent)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readXlsx } from '../lib/xlsx.js';
import { parseAccounts } from '../lib/accounts.js';
import snapshot from '../data/snapshot/accounts.js';
import { enrich, waterfall, byIndustry, scatter, statusSummary, crmGroups, fmtM } from '../public/assets/model.js';

const near = (a, b, eps = 0.051) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

test('snapshot totals match the sheet headline numbers', () => {
  const rows = enrich(snapshot.accounts);
  assert.equal(rows.length, 100);
  const wf = waterfall(rows);
  const get = (k) => wf.steps.find((s) => s.key === k);
  near(get('total').m, 241.1); near(get('Text-only').m, 79.9); assert.equal(get('Text-only').n, 55);
  near(get('vision').m, 161.2); assert.equal(get('vision').n, 45);
  near(get('Medical').m, 20.5); near(get('Image gen').m, 29.4); near(get('Real-time').m, 18.7);
  near(get('EU patient').m, 5.7); near(get('EMEA').m, 12.4); near(get('stalled').m, 7.5);
  near(wf.sellable.m, 67.0); assert.equal(wf.sellable.n, 20);
  near(get('wave1').m, 55.6); near(get('wave2').m, 11.4);
  const ind = Object.fromEntries(byIndustry(rows).map((r) => [r.industry, r]));
  near(ind.FSI.base, 27.0); near(ind.HCLS.base, 28.6); near(ind.Legal.base, 10.5); near(ind.Logistics.base, 0.9);
  const st = Object.fromEntries(statusSummary(rows).map((s) => [s.status, s]));
  near(st['Wave 1'].m, 59.4); near(st['Wave 2'].m, 23.8); near(st.Disqualified.m, 74.3); near(st.Requalify.m, 7.5);
  near(st['Open New Helios Deal'].m, 13.9); near(st['Text-Only'].m, 61.7); near(st['On Hold'].m, 0.5);
  const g = crmGroups(rows, 'prioritization');
  assert.equal(g[0].title, 'Wave 1 — Helios deal in play'); assert.equal(g[0].n, 15); assert.equal(fmtM(g[0].revM), '$116.8M');
  assert.equal(crmGroups(rows, 'industry').find((x) => x.title === 'FSI').extra.startsWith('$27.0M'), true);
});

test('adding a filter back grows sellable by exactly that bucket', () => {
  const rows = enrich(snapshot.accounts);
  const wf = waterfall(rows, new Set(['EMEA']));
  near(wf.sellable.m, 67.0 + 12.4); assert.equal(wf.sellable.n, 27);
  near(byIndustry(rows, new Set(['EMEA'])).reduce((s, r) => s + r.added, 0), 12.4);
});

const path = process.env.SHEET_XLSX;
test('fit / urgency / score / top-20 equal the sheet, row by row', { skip: !path || !fs.existsSync(path) }, () => {
  const wb = readXlsx(fs.readFileSync(path));
  const rows = enrich(parseAccounts(wb).accounts);
  const dash = wb.sheets.find((s) => s.name === 'Dashboard').rows;
  const pts = scatter(rows, { fit: 5, urgency: 5, size: 3 });
  const col = (L) => L.charCodeAt(0) - 65;
  rows.forEach((a, i) => {
    const r = dash[106 + i];
    assert.equal(a.bucket, dash[3 + i][col('U')], `bucket ${a.name}`);
    assert.equal(a.fit, r[col('V')], `fit ${a.name}`);
    assert.equal(a.urgency, r[col('W')], `urgency ${a.name}`);
    near(pts[i].score, r[col('Z')], 0.0501);
    assert.equal(pts[i].top ? 'Top 20' : 'Other', r[col('X')], `group ${a.name}`);
    near(pts[i].x, r[col('Q')], 0.01); near(pts[i].y, r[col('R')], 0.01);
  });
});
