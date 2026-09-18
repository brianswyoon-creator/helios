// Pipeline Dashboard: summary strip, waterfall, sellable-by-industry, account scatter. Each chart has a Chart / Table switch.
import { h, responsive } from '../ui.js';
import { accountsStore, setStatus, setQuery, navigate } from '../app.js';
import { enrich, tileSummary, waterfall, byIndustry, scatter, FILTERS, INDUSTRIES, fmtM, sumM } from '../model.js';
import { drawWaterfall, drawIndustry, drawScatter, legend } from '../charts.js';

const TILES = {
  'Wave 1 — Helios deal in play': { label: 'Wave 1', color: 'var(--c-sellable)' },
  'Wave 1 — No Helios deal yet': { label: 'No Helios Deal Yet', note: 'Part of Wave 1', color: 'var(--c-sellable)' },
  'Wave 2 — Opportunities in play': { label: 'Wave 2', color: 'var(--c-wave)' },
  'Wave 2 — On hold (EU data)': { label: 'On Hold (EU data)', note: 'Part of Wave 2', color: 'var(--c-wave)' },
  Disqualified: { label: 'Disqualified', color: 'var(--c-removed)' },
  Requalify: { label: 'Requalify', color: 'var(--c-hold)' },
  'Open New Helios Deal': { label: 'Open New Helios Deal', color: '#7b6bb5' },
  'Text-Only': { label: 'Text-Only', color: 'var(--c-other)' },
  'On Hold': { label: 'On-Hold', color: 'var(--c-hold)' },
};
const clamp = (v, d) => { const n = Number(v); return v != null && v !== '' && n >= 0 && n <= 10 ? Math.round(n) : d; };
const num = (v) => h('td', { class: 'num' }, v);
const table = (heads, rows) => h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, heads.map(([t, cls]) => h('th', { class: cls }, t)))), h('tbody', null, rows)));
/** A section with its own Chart / Table switch. */
function section(id, title, blurb, onSwitch) {
  const seg = h('div', { class: 'seg small', role: 'group', 'aria-label': `${title}: chart or table` },
    ['Chart', 'Table'].map((t, i) => h('button', { type: 'button', onClick: () => onSwitch(!!i) }, t)));
  const el = h('section', { class: 'card', id }, h('div', { class: 'card-head' }, h('div', null, h('h2', null, title), blurb ? h('p', null, blurb) : null), seg));
  return { el, setMode: (isTable) => [...seg.children].forEach((b, i) => b.setAttribute('aria-pressed', String(isTable === !!i))) };
}

export function mount(root, { query }) {
  const state = {
    rows: [], payload: null,
    addBack: (query.get('addback') || '').split(',').find((b) => FILTERS.some((f) => f.bucket === b)) || '',
    weights: { fit: clamp(query.get('fit'), 5), urgency: clamp(query.get('urgency'), 5), size: clamp(query.get('size'), 3) },
    industries: new Set((query.get('industry') || '').split(',').filter(Boolean)),
    yAxis: query.get('y') === 'score' ? 'score' : 'urgency', sizeBy: query.get('size_by') === 'score' ? 'score' : 'oppM',
    table: { wf: false, ind: false, sc: false },
  };
  const addBackSet = () => new Set(state.addBack ? [state.addBack] : []);
  const sync = () => setQuery({ addback: state.addBack || null, fit: state.weights.fit !== 5 ? state.weights.fit : null, urgency: state.weights.urgency !== 5 ? state.weights.urgency : null, size: state.weights.size !== 3 ? state.weights.size : null, industry: [...state.industries], y: state.yAxis === 'score' ? 'score' : null, size_by: state.sizeBy === 'score' ? 'score' : null });

  const head = h('div', { class: 'page-head' });
  const notice = h('div');
  const tiles = h('div');
  const addBackSel = h('select', { 'aria-label': 'Add back a filter', onChange: (e) => { state.addBack = e.target.value; sync(); drawWf(); drawInd(); } },
    h('option', { value: '' }, 'None — all filters on'), FILTERS.map((f) => h('option', { value: f.bucket }, f.toggle)));
  const wfEl = h('div', { class: 'chart' }), wfLegend = h('div'), wfSummary = h('p', { class: 'small muted', style: { margin: '10px 0 0' } });
  const indEl = h('div', { class: 'chart' }), indLegend = legend(['sellable', 'added']);
  const scEl = h('div', { class: 'chart' }), scLegend = h('div', { class: 'legend' });
  const sliders = h('div', { class: 'sliders' });
  const indChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Highlight industries' });
  const scControls = h('div', { class: 'toolbar', style: { marginBottom: '12px' } });

  const wfSec = section('waterfall', 'Pipeline Waterfall', 'Choose a filter to add that pipeline back. The industry chart follows the same choice.', (t) => { state.table.wf = t; drawWf(); });
  const indSec = section('industry', 'Sellable at GA by Industry', 'Baseline, plus anything added back above.', (t) => { state.table.ind = t; drawInd(); });
  const scSec = section('scatter', 'Account Scatter: Fit vs. Urgency', 'Weights (0–10) re-rank the accounts; the top 20 by weighted score are highlighted. Click a bubble to open the account in the CRM.', (t) => { state.table.sc = t; drawSc(); });
  wfSec.el.append(h('div', { class: 'toolbar', style: { marginBottom: '14px' } }, h('label', { class: 'field' }, 'Add back', addBackSel)), wfEl, wfLegend, wfSummary);
  indSec.el.append(indEl, indLegend);
  scSec.el.append(sliders, scControls, scEl, scLegend);
  root.replaceChildren(head, notice, tiles, wfSec.el, indSec.el, scSec.el);

  [['fit', 'Fit weight'], ['urgency', 'Urgency weight'], ['size', 'Deal size weight']].forEach(([k, label]) => {
    const val = h('b', null, String(state.weights[k]));
    sliders.append(h('div', { class: 'slider' }, h('label', { for: `w-${k}` }, label, val),
      h('input', { id: `w-${k}`, type: 'range', min: 0, max: 10, step: 1, value: state.weights[k], onInput: (e) => { state.weights[k] = Number(e.target.value); val.textContent = e.target.value; sync(); drawSc(); } })));
  });
  const segOf = (label, options, get, set) => h('div', { class: 'field' }, label, h('div', { class: 'seg small', role: 'group', 'aria-label': label },
    options.map(([v, t]) => h('button', { type: 'button', 'data-v': v, onClick: () => { set(v); sync(); drawSc(); } }, t))));
  const ySeg = segOf('Vertical axis', [['urgency', 'Urgency'], ['score', 'Weighted score']], () => state.yAxis, (v) => { state.yAxis = v; });
  const sizeSeg = segOf('Bubble size', [['oppM', 'Deal size ($M)'], ['score', 'Weighted score']], () => state.sizeBy, (v) => { state.sizeBy = v; });
  scControls.append(ySeg, sizeSeg, h('div', { class: 'field' }, 'Highlight industries', indChips));

  const charts = [responsive(wfEl, () => drawWf()), responsive(indEl, () => drawInd()), responsive(scEl, () => drawSc())];

  function drawWf() {
    wfSec.setMode(state.table.wf);
    addBackSel.value = state.addBack;
    const data = waterfall(state.rows, addBackSet());
    if (state.table.wf) {
      wfEl.replaceChildren(table([['Step'], ['$M', 'num'], ['Accounts', 'num'], ['Treatment']], data.steps.map((st) => h('tr', null, h('td', null, st.label), num(`${st.baseKind && !st.added && !st.summary ? '−' : ''}${fmtM(st.m)}`), num(st.n),
        h('td', null, st.added ? 'Added back (filter off)' : { total: 'Subtotal', removed: 'Removed', hold: 'On hold', sellable: 'Result', wave: 'Wave pipeline' }[st.kind])))));
      wfLegend.replaceChildren();
    } else { drawWaterfall(wfEl, data, wfEl.clientWidth); wfLegend.replaceChildren(legend(['total', 'removed', 'hold', 'sellable', 'wave', ...(state.addBack ? ['added'] : [])])); }
    const base = waterfall(state.rows);
    wfSummary.textContent = state.addBack
      ? `Scenario: ${fmtM(data.sellable.m)} sellable across ${data.sellable.n} accounts (baseline ${fmtM(base.sellable.m)} across ${base.sellable.n}; +${fmtM(data.sellable.m - base.sellable.m)} added back).`
      : `Baseline: ${fmtM(base.sellable.m)} sellable at GA across ${base.sellable.n} accounts, ${state.rows.length ? ((base.sellable.m / base.total.m) * 100).toFixed(0) : 0}% of total pipeline.`;
  }
  function drawInd() {
    indSec.setMode(state.table.ind);
    const rows = byIndustry(state.rows, addBackSet());
    const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
    indLegend.hidden = state.table.ind;
    if (state.table.ind) {
      indEl.replaceChildren(table([['Industry'], ['$M', 'num'], ['Accounts', 'num'], ['Baseline $M', 'num'], ['Added back $M', 'num']],
        [...rows.map((r) => h('tr', null, h('td', null, r.industry), num(fmtM(r.total)), num(r.n), num(fmtM(r.base)), num(fmtM(r.added)))),
          h('tr', null, h('td', { class: 'name' }, 'Total'), num(h('b', null, fmtM(sum('total')))), num(h('b', null, sum('n'))), num(h('b', null, fmtM(sum('base')))), num(h('b', null, fmtM(sum('added')))))]));
    } else drawIndustry(indEl, rows, indEl.clientWidth);
  }
  function drawSc() {
    scSec.setMode(state.table.sc);
    ySeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.yAxis)));
    sizeSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.sizeBy)));
    const pts = scatter(state.rows, state.weights);
    const ranked = [...pts].sort((a, b) => a.rank - b.rank);
    if (state.table.sc) {
      scLegend.replaceChildren();
      scEl.replaceChildren(table([['#', 'num'], ['Account'], ['Status'], ['Industry'], ['Fit', 'num'], ['Urgency', 'num'], ['Deal $M', 'num'], ['Weighted score', 'num']],
        ranked.map((p) => h('tr', { style: p.top ? { fontWeight: '700' } : null }, num(p.rank), h('td', null, h('a', { href: `/crm?q=${encodeURIComponent(p.name)}` }, p.name)), h('td', null, p.subStatus), h('td', null, p.industry), num(p.fit), num(p.urgency), num(p.oppM.toFixed(1)), num(p.score.toFixed(1))))));
      return;
    }
    drawScatter(scEl, pts, scEl.clientWidth, { yKey: state.yAxis, sizeKey: state.sizeBy, dimmed: (p) => state.industries.size > 0 && !state.industries.has(p.industry), onPick: (p) => navigate(`/crm?q=${encodeURIComponent(p.name)}`) });
    scLegend.replaceChildren(h('span', null, h('i', { style: { background: 'var(--c-removed)', borderRadius: '50%' } }), 'Top 20 by weighted score'), h('span', null, h('i', { style: { background: 'var(--c-other)', borderRadius: '50%' } }), 'Other accounts'),
      h('span', { class: 'muted' }, `Bubble size = ${state.sizeBy === 'score' ? 'weighted score' : 'deal size ($M)'} · vertical axis = ${state.yAxis === 'score' ? 'weighted score' : 'urgency'}`));
  }

  function renderData() {
    const p = state.payload;
    const total = sumM(state.rows);
    head.replaceChildren(h('div', null, h('h1', null, 'Pipeline Dashboard'), h('p', { class: 'lede' }, `${state.rows.length} target accounts · ${fmtM(total)} open pipeline, by Account Status for Helios GA.`)));
    notice.replaceChildren(p.source === 'snapshot' ? h('div', { class: 'notice' }, h('strong', null, 'Showing the built-in snapshot'), ` (${p.snapshotDate}). The Google Sheet could not be read, so live updates are paused. Share the sheet as “Anyone with the link: Viewer”, then press the status button (top right) to retry.`) : '');
    tiles.replaceChildren(
      h('div', { class: 'tiles' }, tileSummary(state.rows).map((t) => { const cfg = TILES[t.status] || { label: t.status, color: 'var(--c-other)' }; return h('a', { class: 'tile', href: `/crm?status=${encodeURIComponent(t.status)}`, style: { '--tile': cfg.color } },
        h('div', { class: 'k' }, `${cfg.label} ($M)`), h('div', { class: 'v' }, `$${t.m.toFixed(1)}`, h('small', null, 'M')), h('div', { class: 'n' }, `${cfg.note ? `${cfg.note} · ` : ''}${t.n} account${t.n === 1 ? '' : 's'}`)); })),
      h('div', { class: 'tiles-foot' }, `Opportunity size by Account Status for Helios GA. Sums to ${fmtM(total)}.`));
    const known = new Set(state.rows.map((a) => a.industry));
    indChips.replaceChildren(...[...INDUSTRIES.filter((i) => known.has(i)), ...[...known].filter((i) => !INDUSTRIES.includes(i))].map((name) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.industries.has(name)), onClick: (e) => { state.industries.has(name) ? state.industries.delete(name) : state.industries.add(name); e.currentTarget.setAttribute('aria-pressed', String(state.industries.has(name))); sync(); drawSc(); } }, name)));
    drawWf(); drawInd(); drawSc();
  }

  const st = accountsStore();
  const off = st.subscribe(({ data, error, changed }) => {
    setStatus(data, error);
    if (!data || (!changed && state.payload)) return;
    state.payload = data; state.rows = enrich(data.accounts || []);
    renderData();
  });
  return { refresh: (force) => st.refresh(force), destroy() { off(); charts.forEach((c) => c.disconnect()); } };
}
