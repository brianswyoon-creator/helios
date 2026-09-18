// Stakeholder Collaboration: interactive 4-week timeline (like the sheet tab) + stakeholder map.
import { h, bindTip, tipRow } from '../ui.js';
import { stakeholdersStore, setStatus, scrollToHash } from '../app.js';
import { slug } from '../model.js';

const BANDS = ['High', 'Medium', 'Low'];
const HUB = /gtm stratops/i;

export function mount(root) {
  const state = { data: null, urgency: new Set(), team: '', collapsed: new Set(), week: 0, open: new Set(), tab: /^#stakeholder/.test(location.hash) ? 'map' : 'timeline' };
  const head = h('div', { class: 'page-head' });
  const notice = h('div');
  const urgChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by urgency' });
  const teamSel = h('select', { 'aria-label': 'Filter by team', onChange: (e) => { state.team = e.target.value; draw(); } });
  const tl = h('div', { class: 'tl-scroll' });
  const map = h('div', { class: 'map' });
  const tlMeta = h('span', { class: 'small muted' });

  const timelineSec = h('section', { id: 'timeline' },
    h('div', { class: 'toolbar', style: { marginBottom: '14px', alignItems: 'flex-end' } }, urgChips, h('label', { class: 'field' }, 'Team', teamSel),
      h('button', { class: 'btn ghost', type: 'button', onClick: () => { state.collapsed.clear(); draw(); } }, 'Expand all'),
      h('button', { class: 'btn ghost', type: 'button', onClick: () => { state.data?.stakeholders.forEach((s) => state.collapsed.add(s.name)); draw(); } }, 'Collapse all'), tlMeta),
    tl);
  const mapSec = h('section', { id: 'stakeholder-map' },
    h('div', { class: 'toolbar', style: { marginBottom: '14px' } }, h('button', { class: 'btn', type: 'button', onClick: () => { const all = state.data?.stakeholders || []; const openAll = state.open.size < all.length; state.open = new Set(openAll ? all.map((s) => s.name) : []); drawMap(); } }, 'Open / close all')),
    map);
  // Two large tabs switch between the timeline and the map; the address (#timeline / #stakeholder-map) follows.
  const tabs = h('div', { class: 'seg big', role: 'tablist' }, [['timeline', '4-week timeline'], ['map', 'Stakeholder map']].map(([id, label]) =>
    h('button', { type: 'button', role: 'tab', 'data-tab': id, onClick: () => { state.tab = id; history.replaceState(null, '', id === 'map' ? '#stakeholder-map' : '#timeline'); showTab(); } }, label)));
  function showTab() {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === state.tab)));
    timelineSec.hidden = state.tab !== 'timeline';
    mapSec.hidden = state.tab !== 'map';
  }
  showTab();
  root.replaceChildren(head, notice, tabs, timelineSec, mapSec);

  BANDS.forEach((b) => urgChips.append(h('button', { class: 'chip', type: 'button', 'data-u': b, 'aria-pressed': 'false', onClick: () => { state.urgency.has(b) ? state.urgency.delete(b) : state.urgency.add(b); draw(); } },
    h('span', { class: 'sw', style: { background: `var(--c-${b === 'High' ? 'removed' : b === 'Medium' ? 'hold' : 'sellable'})` } }), `${b} urgency`)));

  const visible = (s) => (!state.urgency.size || state.urgency.has(s.urgency)) && (!state.team || s.team === state.team);

  function draw() { drawTimeline(); drawMap(); }

  function drawTimeline() {
    const { weeks, stakeholders } = state.data;
    urgChips.querySelectorAll('[data-u]').forEach((b) => b.setAttribute('aria-pressed', String(state.urgency.has(b.dataset.u))));
    const grid = h('div', { class: 'tl', style: { '--weeks': weeks.length }, role: 'table', 'aria-label': 'Stakeholder timeline' });
    grid.append(h('div', { class: 'th' }, 'Stakeholder / Task'), ...weeks.map((w, i) => h('div', { class: `th wk${i === weeks.length - 1 ? ' ga' : ''}` }, w.label)), h('div', { class: 'th due' }, 'Due'));
    let tasks = 0, owners = 0;
    const bands = [...BANDS, ...new Set(stakeholders.map((s) => s.urgency).filter((u) => !BANDS.includes(u)))];
    for (const band of bands) {
      const group = stakeholders.filter((s) => s.urgency === band && visible(s) && s.tasks.length);
      if (!group.length) continue;
      grid.append(h('div', { class: `band ${band.toLowerCase()}` }, `${(band || 'Other').toUpperCase()} URGENCY`));
      for (const sh of group) {
        owners++;
        const open = !state.collapsed.has(sh.name);
        grid.append(h('button', { class: 'owner', type: 'button', 'aria-expanded': String(open), onClick: () => { open ? state.collapsed.add(sh.name) : state.collapsed.delete(sh.name); drawTimeline(); } },
          h('span', { class: 'caret' }, '▼'), h('span', null, sh.name), sh.decisions.length ? h('span', { class: 'dec' }, `·  decisions: ${sh.decisions.join(', ')}`) : null,
          !open ? h('span', { class: 'dec', style: { marginLeft: 'auto' } }, `${sh.tasks.length} tasks`) : null));
        if (!open) continue;
        for (const t of sh.tasks) {
          tasks++;
          const dim = state.week && (state.week < t.start || state.week > t.end);
          grid.append(h('div', { class: 'task' }, `↳ ${t.label}`));
          weeks.forEach((w, i) => {
            const cell = h('div', { class: `wk span${i === weeks.length - 1 ? ' ga' : ''}` });
            if (w.n === t.start) {
              const bar = h('button', { class: `bar ${band.toLowerCase()}${dim ? ' dim' : ''}`, type: 'button', 'aria-label': `${sh.name}, ${t.due}: ${t.detail}` }, t.label);
              bindTip(bar, () => [h('b', null, t.detail), tipRow('Owner', sh.name), tipRow('When', t.start === t.end ? `Week ${t.start}` : `Weeks ${t.start}–${t.end}`), tipRow('Due', t.due), tipRow('Urgency', sh.urgency)]);
              cell.append(bar);
              if (t.end > t.start) cell.style.gridColumn = `span ${t.end - t.start + 1}`;
            } else if (w.n > t.start && w.n <= t.end) return;
            grid.append(cell);
          });
          grid.append(h('div', { class: 'due' }, t.due));
        }
      }
    }
    tlMeta.textContent = `${owners} stakeholders · ${tasks} tasks shown`;
    tl.replaceChildren(owners ? grid : h('div', { class: 'empty', style: { border: 0, margin: 0 } }, 'No stakeholders match these filters.'));
  }

  function drawMap() {
    const { stakeholders } = state.data;
    const bands = [...BANDS, ...new Set(stakeholders.map((s) => s.urgency).filter((u) => !BANDS.includes(u)))];
    map.replaceChildren(...bands.map((band) => {
      const group = stakeholders.filter((s) => s.urgency === band && visible(s));
      return h('div', { class: 'map-col' }, h('h3', null, h('span', { class: `pill u-${band.toLowerCase()}` }, `${band || 'Other'} urgency`), h('span', { class: 'count' }, `${group.length}`)),
        group.length ? group.map(card) : h('p', { class: 'muted small' }, 'None with these filters.'));
    }));
  }
  function card(sh) {
    const id = `stakeholder-${slug(sh.name)}`;
    const open = state.open.has(sh.name);
    const el = h('article', { class: `sh ${sh.urgency.toLowerCase()}${HUB.test(sh.name) ? ' hub' : ''}`, id, 'data-open': '1' });
    el.addEventListener('deeplink', () => { state.tab = 'map'; showTab(); if (!state.open.has(sh.name)) { state.open.add(sh.name); drawMap(); document.getElementById(id)?.scrollIntoView(); } });
    el.append(h('button', { type: 'button', 'aria-expanded': String(open), onClick: () => { open ? state.open.delete(sh.name) : state.open.add(sh.name); if (!open) history.replaceState(null, '', `#${id}`); drawMap(); } },
      h('div', { class: 'top' }, h('div', { class: 'nm' }, sh.name), h('span', { class: 'tag' }, sh.team || '—')),
      h('div', { class: 'meta' }, sh.deadline ? h('span', null, `Due: ${sh.deadline}`) : null, HUB.test(sh.name) ? h('span', { class: 'tag' }, 'Launch owner') : null, sh.risk ? h('span', { class: `pill u-${sh.risk.toLowerCase()}` }, `Risk: ${sh.risk}`) : null),
      h('div', { class: 'meta' }, sh.decisions.map((d) => h('span', { class: 'tag' }, d)))));
    if (open) {
      const byWeek = new Map();
      sh.tasks.forEach((t) => byWeek.set(t.start, [...(byWeek.get(t.start) || []), t.detail]));
      el.append(h('div', { class: 'body' },
        sh.needs ? [h('h4', null, 'What needs to happen'), h('p', null, sh.needs)] : null,
        sh.pushback ? [h('h4', null, 'Expected pushback'), h('p', null, sh.pushback)] : null,
        sh.resolution ? [h('h4', null, 'Resolution'), h('p', null, sh.resolution)] : null,
        byWeek.size ? [h('h4', null, 'Tasks by week'), h('ul', null, [...byWeek].sort((a, b) => a[0] - b[0]).map(([w, items]) => h('li', null, h('strong', null, `W${w}: `), items.join('; '))))] : null));
    }
    return el;
  }

  const st = stakeholdersStore();
  let first = true;
  const off = st.subscribe(({ data, error, changed }) => {
    setStatus(data, error);
    if (!data || (!changed && state.data)) return;
    state.data = data;
    const n = data.stakeholders.length, tasks = data.stakeholders.reduce((k, s) => k + s.tasks.length, 0);
    head.replaceChildren(h('div', null, h('h1', null, 'Stakeholder Collaboration'),
      h('p', { class: 'lede' }, `${n} stakeholder groups · ${tasks} tasks · ${data.weeks.length} weeks to GA.`)));
    notice.replaceChildren(data.source === 'snapshot' ? h('div', { class: 'notice' }, h('strong', null, 'Showing the built-in snapshot'), ` (${data.snapshotDate}). The Google Sheet could not be read, so live updates are paused.`) : '');
    const teams = [...new Set(data.stakeholders.map((s) => s.team).filter(Boolean))].sort();
    teamSel.replaceChildren(h('option', { value: '' }, 'All teams'), ...teams.map((t) => h('option', { value: t, selected: t === state.team }, t)));
    draw();
    if (first) { first = false; if (state.tab === 'map') scrollToHash(); }
  });
  return { refresh: (force) => st.refresh(force), destroy: off };
}
