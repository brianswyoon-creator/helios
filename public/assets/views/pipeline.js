// Pipeline Dashboard: status tiles, waterfall, sellable-by-industry, account scatter.
import { h, responsive } from '../ui.js';
import { accountsStore, setStatus, setQuery, navigate } from '../app.js';
import { enrich, statusSummary, waterfall, byIndustry, scatter, FILTERS, INDUSTRIES, fmtM, sumM } from '../model.js';
import { drawWaterfall, drawIndustry, drawScatter, legend } from '../charts.js';

const TILE_COLOR = { 'Wave 1': 'var(--c-sellable)', 'Wave 2': 'var(--c-wave)', Disqualified: 'var(--c-removed)', Requalify: 'var(--c-hold)', 'Open New Helios Deal': '#7b6bb5', 'Text-Only': 'var(--c-other)', 'On Hold': 'var(--c-hold)' };

export function mount(root, { query }) {
  const state = {
    rows: [], payload: null,
    addBack: new Set((query.get('addback') || '').split(',').filter((b) => FILTERS.some((f) => f.bucket === b))),
    weights: { fit: clamp(query.get('fit'), 5), urgency: clamp(query.get('urgency'), 5), size: clamp(query.get('size'), 3) },
    industries: new Set((query.get('industry') || '').split(',').filter(Boolean)),
    labels: true, wfTable: false,
  };
  function clamp(v, d) { const n = Number(v); return v != null && v !== '' && n >= 0 && n <= 10 ? Math.round(n) : d; }
  const sync = () => setQuery({ addback: [...state.addBack], fit: state.weights.fit !== 5 ? state.weights.fit : null, urgency: state.weights.urgency !== 5 ? state.weights.urgency : null, size: state.weights.size !== 3 ? state.weights.size : null, industry: [...state.industries] });

  const head = h('div', { class: 'page-head' });
  const notice = h('div');
  const tiles = h('div');
  const filterChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Add-back filters' });
  const wfEl = h('div', { class: 'chart' }), wfLegend = h('div'), wfSummary = h('p', { class: 'small muted', style: { margin: '10px 0 0' } });
  const indEl = h('div', { class: 'chart' }), indTable = h('div', { style: { marginTop: '16px' } });
  const scEl = h('div', { class: 'chart' });
  const sliders = h('div', { class: 'sliders' });
  const indChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Highlight industries' });
  const topList = h('div');
  const wfToggle = h('div', { class: 'seg small' },
    h('button', { type: 'button', onClick: () => { state.wfTable = false; drawAll(); } }, 'Chart'),
    h('button', { type: 'button', onClick: () => { state.wfTable = true; drawAll(); } }, 'Table'));

  root.replaceChildren(
    head, notice, tiles,
    h('section', { class: 'card section', id: 'waterfall' },
      h('div', { class: 'card-head' },
        h('div', null, h('h2', null, 'Pipeline Waterfall'), h('p', null, 'From total pipeline to what is sellable at GA. Switch a filter off to add that pipeline back and test a scenario; the industry chart below follows the same switches.')),
        wfToggle),
      h('div', { class: 'small muted', style: { marginBottom: '8px' } }, 'Add back (filter off):'),
      filterChips, h('div', { style: { height: '14px' } }), wfEl, wfLegend, wfSummary),
    h('div', { class: 'grid-2' },
      h('section', { class: 'card', id: 'industry' },
        h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Sellable at GA by Industry'), h('p', null, 'Baseline with all filters on, plus anything added back by the scenario switches above.'))),
        indEl, legend(['sellable', 'added']), indTable),
      h('section', { class: 'card', id: 'scatter' },
        h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Account Scatter: Fit vs. Urgency'), h('p', null, 'Bubble size is deal size ($M). Change the weights (0–10) to re-rank; the top 20 by weighted score are highlighted. Click a bubble to open the account in the CRM.'))),
        sliders, h('div', { class: 'small muted', style: { margin: '2px 0 8px' } }, 'Highlight industries:'), indChips, h('div', { style: { height: '10px' } }), scEl,
        h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: 'var(--c-removed)', borderRadius: '50%' } }), 'Top 20 by weighted score'), h('span', null, h('i', { style: { background: 'var(--c-other)', borderRadius: '50%' } }), 'Other accounts')),
        topList)));

  // Controls are built once so focus and slider drags survive live data refreshes.
  FILTERS.forEach((f) => filterChips.append(h('button', { class: 'chip', type: 'button', 'data-bucket': f.bucket, title: f.label, onClick: () => { state.addBack.has(f.bucket) ? state.addBack.delete(f.bucket) : state.addBack.add(f.bucket); sync(); drawAll(); } },
    h('span', { class: 'sw', style: { background: f.kind === 'hold' ? 'var(--c-hold)' : 'var(--c-removed)' } }), f.toggle)));
  filterChips.append(h('button', { class: 'btn ghost', type: 'button', onClick: () => { state.addBack.clear(); sync(); drawAll(); } }, 'Reset'));
  [['fit', 'Fit weight'], ['urgency', 'Urgency weight'], ['size', 'Deal size weight']].forEach(([k, label]) => {
    const val = h('b', null, String(state.weights[k]));
    sliders.append(h('div', { class: 'slider' }, h('label', { for: `w-${k}` }, label, val),
      h('input', { id: `w-${k}`, type: 'range', min: 0, max: 10, step: 1, value: state.weights[k], onInput: (e) => { state.weights[k] = Number(e.target.value); val.textContent = e.target.value; sync(); drawScatterOnly(); } })));
  });

  const charts = [responsive(wfEl, () => drawWf()), responsive(indEl, () => drawInd()), responsive(scEl, () => drawSc())];
  const wf = () => waterfall(state.rows, state.addBack);
  function drawWf() {
    [...wfToggle.children].forEach((b, i) => b.setAttribute('aria-pressed', String(state.wfTable === !!i)));
    const data = wf();
    if (state.wfTable) {
      wfEl.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Step'), h('th', { class: 'num' }, '$M'), h('th', { class: 'num' }, 'Accounts'), h('th', null, 'Treatment'))),
        h('tbody', null, data.steps.map((st) => h('tr', null, h('td', null, st.label), h('td', { class: 'num' }, `${st.baseKind && !st.added && !st.summary ? '−' : ''}${fmtM(st.m)}`), h('td', { class: 'num' }, st.n),
          h('td', null, st.added ? 'Added back (filter off)' : { total: 'Subtotal', removed: 'Removed', hold: 'On hold', sellable: 'Result', wave: 'Wave pipeline' }[st.kind])))))));
    } else drawWaterfall(wfEl, data, wfEl.clientWidth);
    wfLegend.replaceChildren(legend(['total', 'removed', 'hold', 'sellable', 'wave', ...(state.addBack.size ? ['added'] : [])]));
    const base = waterfall(state.rows);
    wfSummary.textContent = state.addBack.size
      ? `Scenario: ${fmtM(data.sellable.m)} sellable across ${data.sellable.n} accounts (baseline ${fmtM(base.sellable.m)} across ${base.sellable.n}; +${fmtM(data.sellable.m - base.sellable.m)} added back).`
      : `Baseline: ${fmtM(base.sellable.m)} sellable at GA across ${base.sellable.n} accounts, ${state.rows.length ? ((base.sellable.m / base.total.m) * 100).toFixed(0) : 0}% of total pipeline.`;
    filterChips.querySelectorAll('[data-bucket]').forEach((b) => b.setAttribute('aria-pressed', String(state.addBack.has(b.dataset.bucket))));
  }
  function drawInd() {
    const rows = byIndustry(state.rows, state.addBack);
    drawIndustry(indEl, rows, indEl.clientWidth);
    const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
    indTable.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, 'Industry'), ['$M', 'Accounts', 'Baseline $M', 'Added back $M'].map((t) => h('th', { class: 'num' }, t)))),
      h('tbody', null, rows.map((r) => h('tr', null, h('td', null, r.industry), h('td', { class: 'num' }, fmtM(r.total)), h('td', { class: 'num' }, r.n), h('td', { class: 'num' }, fmtM(r.base)), h('td', { class: 'num' }, fmtM(r.added)))),
        h('tr', null, h('td', { class: 'name' }, 'Total'), h('td', { class: 'num name' }, fmtM(sum('total'))), h('td', { class: 'num name' }, sum('n')), h('td', { class: 'num name' }, fmtM(sum('base'))), h('td', { class: 'num name' }, fmtM(sum('added'))))))));
  }
  function drawSc() {
    const pts = scatter(state.rows, state.weights);
    drawScatter(scEl, pts, scEl.clientWidth, { labels: state.labels, dimmed: (p) => state.industries.size > 0 && !state.industries.has(p.industry), onPick: (p) => navigate(`/crm?q=${encodeURIComponent(p.name)}`) });
    const top = pts.filter((p) => p.top).sort((a, b) => a.rank - b.rank);
    topList.replaceChildren(h('details', { style: { marginTop: '14px' } }, h('summary', { class: 'small', style: { cursor: 'pointer' } }, `Top 20 as a table (${fmtM(sumM(top))} combined)`),
      h('div', { class: 'table-wrap', style: { marginTop: '10px' } }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, ['#', 'Account', 'Status', 'Industry'].map((t) => h('th', null, t)), ['Fit', 'Urgency', '$M', 'Score'].map((t) => h('th', { class: 'num' }, t)))),
        h('tbody', null, top.map((p) => h('tr', null, h('td', null, p.rank), h('td', { class: 'name' }, h('a', { href: `/crm?q=${encodeURIComponent(p.name)}` }, p.name)), h('td', null, p.status), h('td', null, p.industry),
          h('td', { class: 'num' }, p.fit), h('td', { class: 'num' }, p.urgency), h('td', { class: 'num' }, p.oppM.toFixed(1)), h('td', { class: 'num' }, p.score.toFixed(1)))))))));
  }
  const drawScatterOnly = () => drawSc();
  function drawAll() { drawWf(); drawInd(); drawSc(); }

  function renderData() {
    const p = state.payload;
    const total = sumM(state.rows);
    head.replaceChildren(
      h('div', null, h('div', { class: 'eyebrow' }, 'Helios GA launch'), h('h1', null, 'Pipeline Dashboard'),
        h('p', { class: 'lede' }, `${state.rows.length} target accounts and ${fmtM(total)} of open pipeline, sorted into what we can sell at GA, what waits, and what we walk away from.`)),
      h('div', { class: 'source' }, 'Source: ', h('a', { href: p.sheetUrl, target: '_blank', rel: 'noopener' }, 'Target Account List ↗'), h('br'), `tab “${p.tab || 'TargetAccounts'}”`));
    notice.replaceChildren(p.source === 'snapshot' ? h('div', { class: 'notice' }, h('strong', null, 'Showing the built-in snapshot'), ` (${p.snapshotDate}). The Google Sheet could not be read, so live updates are paused. Share the sheet as “Anyone with the link: Viewer”, then press the status button (top right) to retry.`) : '');
    const summary = statusSummary(state.rows);
    tiles.replaceChildren(
      h('div', { class: 'tiles' }, summary.map((t) => h('a', { class: 'tile', href: `/crm?status=${encodeURIComponent(t.status)}`, style: { '--tile': TILE_COLOR[t.status] }, title: `Open ${t.status} accounts in the CRM` },
        h('div', { class: 'k' }, `${t.status === 'On Hold' ? 'On-Hold' : t.status} ($M)`), h('div', { class: 'v' }, `$${t.m.toFixed(1)}`, h('small', null, 'M')), h('div', { class: 'n' }, `${t.n} account${t.n === 1 ? '' : 's'}`)))),
      h('div', { class: 'tiles-foot' }, `Opportunity size by “Account Status for Helios GA”. The seven statuses add up to the ${fmtM(total)} total pipeline. Click a tile to see those accounts.`));
    const known = new Set(state.rows.map((a) => a.industry));
    indChips.replaceChildren(...[...INDUSTRIES.filter((i) => known.has(i)), ...[...known].filter((i) => !INDUSTRIES.includes(i))].map((name) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.industries.has(name)), onClick: (e) => { state.industries.has(name) ? state.industries.delete(name) : state.industries.add(name); e.currentTarget.setAttribute('aria-pressed', String(state.industries.has(name))); sync(); drawSc(); } }, name)));
    drawAll();
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
