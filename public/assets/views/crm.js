// CRM: the account list in the same four views as the Google Sheet tabs, with search and filters.
import { h } from '../ui.js';
import { accountsStore, setStatus, setQuery } from '../app.js';
import { enrich, crmGroups, VIEWS, SUB_STATUSES, fmtM, slug } from '../model.js';

// The table shows only what fits on one screen; everything else is in the expanded row.
const COLS = [
  ['#', (a) => a.rank, 'num'],
  ['Account', (a) => [h('div', { class: 'name' }, a.name), h('div', { class: 'sub' }, [a.industry, a.subIndustry, a.region].filter(Boolean).join(' · '))]],
  ['Status', (a) => h('span', { class: `pill s-${slug(a.status)}` }, a.status)],
  ['Next step', (a) => h('div', { class: 'clamp' }, a.next)],
  ['Owner', (a) => a.owner],
  ['Annual revenue ($K)', (a) => a.revenueK.toLocaleString('en-US'), 'num'],
  ['Opportunity ($K)', (a) => a.oppK.toLocaleString('en-US'), 'num'],
  ['', () => h('span', { class: 'caret', 'aria-hidden': 'true' }, '▾')],
];
// "Deal / Revenue" in the sheet is a ratio (Helios opportunity ÷ current annual revenue), only filled for accounts with a Helios deal.
const dealRatio = (a) => (/^[\d.]+x$/.test(a.dealRev) ? a.dealRev : '');

export function mount(root, { query }) {
  const state = { rows: [], payload: null, view: VIEWS.some((v) => v.id === query.get('view')) ? query.get('view') : 'prioritization', q: query.get('q') || '', status: query.get('status') || '', industry: query.get('industry') || '', open: new Set() };
  const sync = () => setQuery({ view: state.view === 'prioritization' ? null : state.view, q: state.q, status: state.status, industry: state.industry });

  const head = h('div', { class: 'page-head' });
  const notice = h('div');
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'CRM view' }, VIEWS.map((v) => h('button', { type: 'button', 'data-view': v.id, onClick: () => { state.view = v.id; sync(); fillSelects(); renderList(); } }, v.label)));
  const search = h('input', { type: 'search', placeholder: 'Search account or owner…', value: state.q, 'aria-label': 'Search by account or owner name', onInput: (e) => { state.q = e.target.value; sync(); renderList(); } });
  const statusSel = h('select', { 'aria-label': 'Filter by account status', onChange: (e) => { state.status = e.target.value; sync(); renderList(); } });
  const industrySel = h('select', { 'aria-label': 'Filter by industry', onChange: (e) => { state.industry = e.target.value; sync(); renderList(); } });
  const statusField = h('label', { class: 'field' }, 'Status', statusSel);
  const active = h('div', { class: 'active-filters' });
  const count = h('div', { class: 'small muted', style: { marginLeft: 'auto', alignSelf: 'center' } });
  const clear = h('button', { class: 'btn ghost', type: 'button', onClick: () => { state.q = state.status = state.industry = ''; search.value = ''; sync(); fillSelects(); renderList(); } }, 'Clear filters');
  const list = h('div');

  root.replaceChildren(head, notice,
    h('div', { class: 'card' },
      h('div', { class: 'step' }, h('span', { class: 'step-k' }, 'View'), seg),
      h('div', { class: 'step' }, h('span', { class: 'step-k' }, 'Filter'), h('div', { class: 'toolbar', style: { flex: '1' } },
        h('label', { class: 'field grow' }, 'Account or owner', search), statusField, h('label', { class: 'field' }, 'Industry', industrySel), clear, count)),
      active),
    list);

  function fillSelects() {
    const inView = new Set(crmGroups(state.rows, state.view).flatMap((g) => g.rows.map((a) => a.subStatus)));
    const statuses = [...SUB_STATUSES.filter((s) => inView.has(s)), ...[...inView].filter((s) => !SUB_STATUSES.includes(s))];
    const industries = [...new Set(state.rows.map((a) => a.industry).filter(Boolean))].sort();
    const fill = (sel, all, items, value) => sel.replaceChildren(h('option', { value: '' }, all), ...items.map((i) => h('option', { value: i, selected: i === value }, i)));
    fill(statusSel, 'All statuses', statuses, state.status);
    fill(industrySel, 'All industries', industries, state.industry);
  }

  function renderList() {
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    const q = state.q.trim().toLowerCase();
    const match = (a) => (!q || a.name.toLowerCase().includes(q) || a.owner.toLowerCase().includes(q)) && (!state.status || a.subStatus === state.status || a.status === state.status) && (!state.industry || a.industry === state.industry);
    const groups = crmGroups(state.rows, state.view).map((g) => ({ ...g, shown: g.rows.filter(match) })).filter((g) => g.shown.length);
    const shown = groups.reduce((n, g) => n + g.shown.length, 0), total = crmGroups(state.rows, state.view).reduce((n, g) => n + g.n, 0);
    const filtered = !!(q || state.status || state.industry);
    const chipFor = (label, reset) => h('button', { class: 'chip', type: 'button', title: 'Remove this filter', onClick: () => { reset(); search.value = state.q; sync(); fillSelects(); renderList(); } }, label, h('span', { 'aria-hidden': 'true' }, '✕'));
    active.replaceChildren(...(filtered ? [h('span', { class: 'small muted' }, 'Showing only:'),
      q ? chipFor(`Account or owner contains “${state.q.trim()}”`, () => { state.q = ''; }) : null,
      state.status ? chipFor(`Status: ${state.status}`, () => { state.status = ''; }) : null,
      state.industry ? chipFor(`Industry: ${state.industry}`, () => { state.industry = ''; }) : null].filter(Boolean) : []));
    count.textContent = filtered ? `${shown} of ${total} accounts` : '';
    clear.style.visibility = filtered ? 'visible' : 'hidden';
    if (!groups.length) { list.replaceChildren(h('div', { class: 'empty' }, state.rows.length ? 'No accounts match these filters in this view.' : 'No account data yet.')); return; }
    list.replaceChildren(...groups.map((g) => h('section', { class: 'group' },
      h('div', { class: 'group-head' }, h('h3', null, g.title), h('span', { class: 'stats' }, [`${g.n} accounts`, `${fmtM(g.revM)} total annual revenue`, `${fmtM(g.oppM)} total opportunity size`, g.extra].filter(Boolean).join('  ·  ')),
        filtered && g.shown.length !== g.n ? h('span', { class: 'pill' }, `${g.shown.length} shown`) : null),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, COLS.map(([t, , cls]) => h('th', { class: cls }, t)))),
        h('tbody', null, g.shown.map((a) => rowsFor(a, g.title))))))));
  }
  function rowsFor(a, groupTitle) {
    const id = `${groupTitle}|${a.name}`;
    const tr = h('tr', { class: 'row', tabindex: 0, 'aria-expanded': String(state.open.has(id)) }, COLS.map(([, get, cls]) => h('td', { class: cls }, get(a))));
    const ratio = dealRatio(a);
    const detail = h('tr', { class: 'detail', hidden: !state.open.has(id) }, h('td', { colSpan: COLS.length }, h('div', { class: 'detail-body' },
      h('div', { class: 'facts' },
        h('div', null, h('h4', null, 'Opportunity'), h('p', null, a.oppName || '—')),
        h('div', null, h('h4', null, 'Sub-industry · Region'), h('p', null, [a.subIndustry, a.region].filter(Boolean).join(' · ') || '—')),
        ratio ? h('div', null, h('h4', null, 'Deal ÷ revenue'), h('p', null, h('strong', null, ratio), h('span', { class: 'muted' }, ' · Helios opportunity as a multiple of current annual revenue'))) : null),
      h('div', { class: 'detail-grid' },
        h('div', null, h('h4', null, 'Next steps / actions'), h('p', null, a.next || '—')), h('div', null, h('h4', null, 'Opportunity notes'), h('p', null, a.oppNotes || '—')), h('div', null, h('h4', null, 'Account notes'), h('p', null, a.acctNotes || '—'))))));
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
    head.replaceChildren(h('div', null, h('h1', null, 'CRM')));
    notice.replaceChildren(data.source === 'snapshot' ? h('div', { class: 'notice' }, h('strong', null, 'Showing the built-in snapshot'), ` (${data.snapshotDate}). The Google Sheet could not be read, so live updates are paused.`) : '');
    fillSelects(); renderList();
  });
  return { refresh: (force) => st.refresh(force), destroy: off };
}
