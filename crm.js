// CRM: the account list in the same four views as the Google Sheet tabs, with search and filters.
import { h } from '../ui.js';
import { accountsStore, setStatus, setQuery } from '../app.js';
import { enrich, crmGroups, VIEWS, STATUSES, fmtM, slug } from '../model.js';

const COLS = [
  ['Rank', (a) => a.rank, 'num'], ['Account name', (a) => h('span', { class: 'name' }, a.name)], ['Account Status for Helios GA', (a) => h('span', { class: `pill s-${slug(a.status)}` }, a.status)],
  ['Next Steps / Actions', (a) => h('div', { class: 'clamp', title: a.next }, a.next)], ['Opportunity name', (a) => a.oppName], ['Account owner', (a) => a.owner], ['Industry', (a) => a.industry],
  ['Sub-industry', (a) => a.subIndustry], ['Region', (a) => a.region], ['Annual revenue ($K)', (a) => a.revenueK.toLocaleString('en-US'), 'num'], ['Opportunity size ($K)', (a) => a.oppK.toLocaleString('en-US'), 'num'], ['Deal / Revenue', (a) => a.dealRev, 'num'],
];

export function mount(root, { query }) {
  const state = { rows: [], payload: null, view: VIEWS.some((v) => v.id === query.get('view')) ? query.get('view') : 'prioritization', q: query.get('q') || '', status: query.get('status') || '', industry: query.get('industry') || '', open: new Set() };
  const sync = () => setQuery({ view: state.view === 'prioritization' ? null : state.view, q: state.q, status: state.status, industry: state.industry });

  const head = h('div', { class: 'page-head' });
  const notice = h('div');
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'CRM view' }, VIEWS.map((v) => h('button', { type: 'button', 'data-view': v.id, onClick: () => { state.view = v.id; sync(); renderList(); } }, v.label)));
  const search = h('input', { type: 'search', placeholder: 'Search account name…', value: state.q, 'aria-label': 'Search by account name', onInput: (e) => { state.q = e.target.value; sync(); renderList(); } });
  const statusSel = h('select', { 'aria-label': 'Filter by account status', onChange: (e) => { state.status = e.target.value; sync(); renderList(); } });
  const industrySel = h('select', { 'aria-label': 'Filter by industry', onChange: (e) => { state.industry = e.target.value; sync(); renderList(); } });
  const count = h('div', { class: 'small muted', style: { marginLeft: 'auto', alignSelf: 'center' } });
  const clear = h('button', { class: 'btn ghost', type: 'button', onClick: () => { state.q = state.status = state.industry = ''; search.value = ''; sync(); fillSelects(); renderList(); } }, 'Clear filters');
  const list = h('div');

  root.replaceChildren(head, notice, seg,
    h('div', { class: 'card section' }, h('div', { class: 'toolbar' },
      h('label', { class: 'field grow' }, 'Account name', search), h('label', { class: 'field' }, 'Account Status for Helios GA', statusSel), h('label', { class: 'field' }, 'Industry', industrySel), clear, count)),
    list);

  function fillSelects() {
    const statuses = [...STATUSES.filter((s) => state.rows.some((a) => a.status === s)), ...new Set(state.rows.map((a) => a.status).filter((s) => s && !STATUSES.includes(s)))];
    const industries = [...new Set(state.rows.map((a) => a.industry).filter(Boolean))].sort();
    const fill = (sel, all, items, value) => sel.replaceChildren(h('option', { value: '' }, all), ...items.map((i) => h('option', { value: i, selected: i === value }, i)));
    fill(statusSel, 'All statuses', statuses, state.status);
    fill(industrySel, 'All industries', industries, state.industry);
  }

  function renderList() {
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    const q = state.q.trim().toLowerCase();
    const match = (a) => (!q || a.name.toLowerCase().includes(q)) && (!state.status || a.status === state.status) && (!state.industry || a.industry === state.industry);
    const groups = crmGroups(state.rows, state.view).map((g) => ({ ...g, shown: g.rows.filter(match) })).filter((g) => g.shown.length);
    const shown = groups.reduce((n, g) => n + g.shown.length, 0), total = crmGroups(state.rows, state.view).reduce((n, g) => n + g.n, 0);
    const filtered = !!(q || state.status || state.industry);
    count.textContent = filtered ? `${shown} of ${total} accounts` : `${total} accounts`;
    clear.style.visibility = filtered ? 'visible' : 'hidden';
    const view = VIEWS.find((v) => v.id === state.view);
    if (!groups.length) { list.replaceChildren(h('div', { class: 'empty' }, state.rows.length ? 'No accounts match these filters in this view.' : 'No account data yet.')); return; }
    list.replaceChildren(h('p', { class: 'muted', style: { margin: '26px 0 0' } }, view.title), ...groups.map((g) => h('section', { class: 'group' },
      h('div', { class: 'group-head' }, h('h3', null, g.title), h('span', { class: 'stats' }, [`${g.n} accounts`, `${fmtM(g.revM)} total annual revenue`, `${fmtM(g.oppM)} total opportunity size`, g.extra].filter(Boolean).join('  ·  ')),
        filtered && g.shown.length !== g.n ? h('span', { class: 'pill' }, `${g.shown.length} shown`) : null),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, COLS.map(([t, , cls]) => h('th', { class: cls }, t)))),
        h('tbody', null, g.shown.map((a) => rowsFor(a, g.title))))))));
  }
  function rowsFor(a, groupTitle) {
    const id = `${groupTitle}|${a.name}`;
    const tr = h('tr', { class: 'row', tabindex: 0, 'aria-expanded': String(state.open.has(id)) }, COLS.map(([, get, cls]) => h('td', { class: cls }, get(a))));
    const detail = h('tr', { class: 'detail', hidden: !state.open.has(id) }, h('td', { colSpan: COLS.length }, h('div', { class: 'detail-grid' },
      h('div', null, h('h4', null, 'Next Steps / Actions'), h('p', null, a.next || '—')), h('div', null, h('h4', null, 'Opportunity notes'), h('p', null, a.oppNotes || '—')), h('div', null, h('h4', null, 'Account notes'), h('p', null, a.acctNotes || '—')))));
    const toggle = () => { state.open.has(id) ? state.open.delete(id) : state.open.add(id); detail.hidden = !state.open.has(id); tr.setAttribute('aria-expanded', String(state.open.has(id))); };
    tr.addEventListener('click', toggle);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    return [tr, detail];
  }

  const st = accountsStore();
  const off = st.subscribe(({ data, error, changed }) => {
    setStatus(data, error);
    if (!data || (!changed && state.payload)) return;
    state.payload = data; state.rows = enrich(data.accounts || []);
    head.replaceChildren(h('div', null, h('div', { class: 'eyebrow' }, 'Helios GA launch'), h('h1', null, 'CRM'), h('p', { class: 'lede' }, 'Every target account with its Helios GA status, next step and owner. Pick a view, then search or filter. Click a row for the full notes.')),
      h('div', { class: 'source' }, 'Source: ', h('a', { href: data.sheetUrl, target: '_blank', rel: 'noopener' }, 'Target Account List ↗')));
    notice.replaceChildren(data.source === 'snapshot' ? h('div', { class: 'notice' }, h('strong', null, 'Showing the built-in snapshot'), ` (${data.snapshotDate}). The Google Sheet could not be read, so live updates are paused.`) : '');
    fillSelects(); renderList();
  });
  return { refresh: (force) => st.refresh(force), destroy: off };
}
