// One Launch Materials document: live Google Doc reader, AE account cards, or the launch tracker.
import { h, copyLink } from '../ui.js';
import { store, stakeholdersStore, setStatus, scrollToHash } from '../app.js';
import { wipBanner, downloads } from './materials.js';
import { slug as slugify } from '../model.js';

const money = (k) => (k == null ? '—' : `$${(k / 1000).toFixed(1)}M`);
const anchorBtn = (path, id) => h('button', { class: 'anchor', type: 'button', title: 'Copy link to this section', 'aria-label': 'Copy link to this section', onClick: (e) => { e.stopPropagation(); history.replaceState(null, '', `#${id}`); copyLink(`${path}#${id}`, 'Section link copied'); } }, '#');

export function mount(root, { params }) {
  const slug = params[0];
  const path = `/materials/${slug}`;
  const header = h('div');
  const body = h('div', { class: 'skeleton' }, 'Loading document…');
  root.replaceChildren(h('div', { class: 'crumbs' }, h('a', { href: '/materials' }, '← Launch Materials Center')), header, body);
  let first = true, offExtra = null;
  const afterRender = () => { if (first) { first = false; requestAnimationFrame(scrollToHash); } };

  function renderHeader(d) {
    document.title = `${d.title} · Helios Launch Hub`;
    header.replaceChildren(
      h('div', { class: 'page-head', style: { marginBottom: '18px' } },
        h('div', null, h('div', { class: 'eyebrow' }, 'Enablement Materials · WIP'), h('h1', null, d.title), h('p', { class: 'lede' }, d.blurb)),
        h('div', { class: 'doc-actions' }, downloads(d), d.docUrl ? h('a', { class: 'btn', href: d.docUrl, target: '_blank', rel: 'noopener' }, 'Open in Google Docs ↗') : null,
          h('button', { class: 'btn primary', type: 'button', onClick: () => copyLink(path + location.hash) }, 'Copy link'))),
      wipBanner());
  }

  function renderDoc(d) {
    if (d.source === 'unavailable') {
      body.className = '';
      body.replaceChildren(h('div', { class: 'empty' }, h('h3', null, 'This Google Doc can’t be read yet'), h('p', null, 'Share the document as “Anyone with the link: Viewer” and it will appear here automatically within a few seconds.'),
        h('p', { class: 'small muted' }, d.error), h('a', { class: 'btn', href: d.docUrl, target: '_blank', rel: 'noopener' }, 'Open in Google Docs ↗')));
      return;
    }
    const article = h('article', { class: 'doc', html: d.html }); // server-sanitised HTML (see lib/sanitize.js)
    article.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]').forEach((el) => el.prepend(anchorBtn(path, el.id)));
    const top = Math.min(...d.headings.map((x) => x.level), 6);
    const toc = d.headings.filter((x) => x.level - top < 3);
    body.className = 'doc-layout';
    body.replaceChildren(
      h('nav', { class: 'toc', 'aria-label': 'On this page' }, h('h4', null, 'On this page'), toc.length ? toc.map((x) => h('a', { class: `l${x.level - top + 1}`, href: `#${x.id}` }, x.text)) : h('span', { class: 'muted small' }, 'No headings'),
        h('p', { class: 'small muted', style: { marginTop: '14px' } }, `${d.words.toLocaleString('en-US')} words · live from Google Docs`)),
      article);
  }

  function renderCards(d) {
    const TL = { A: 'Tier A · budget or launch-week start', B: 'Tier B · explicit Helios ask', C: 'Tier C · pain in notes, no deal yet' };
    const search = h('input', { type: 'search', placeholder: 'Filter accounts, owners, use cases…', 'aria-label': 'Filter cards' });
    const index = h('div', { class: 'idx' }), cards = h('div');
    const ul = (items) => h('ul', null, items.map((x) => h('li', null, x)));
    function draw() {
      const q = search.value.trim().toLowerCase();
      const items = d.cards.filter((c) => !q || `${c.name} ${c.owner} ${c.use} ${c.ind} ${c.why}`.toLowerCase().includes(q));
      let tier = '';
      index.replaceChildren(...items.flatMap((c) => { const out = []; if (c.tier !== tier) { tier = c.tier; out.push(h('div', { class: 'grp' }, TL[tier] || `Tier ${tier}`)); } out.push(h('a', { href: `#${slugify(c.name)}` }, c.name, h('span', null, c.deal ? money(c.deal) : 'new deal'))); return out; }));
      cards.replaceChildren(...(items.length ? items.map((c) => { const id = slugify(c.name); return h('article', { class: 'acard', id },
        h('div', { class: 'acard-top' }, h('div', null, h('h3', null, anchorBtn(path, id), c.name), h('div', { class: 'meta' }, `${c.ind} · ${c.region} · Owner: ${c.owner}`)), h('span', { class: 'pill' }, `Tier ${c.tier} · #${c.rank} by revenue`)),
        h('div', { class: 'stats' }, [[money(c.rev), 'Existing annual revenue'], [c.deal ? money(c.deal) : 'None yet', 'Helios deal'], [c.deal ? `${(c.deal / c.rev).toFixed(2)}x` : '—', 'Deal ÷ revenue'], [c.deal ? 'Open' : 'Create', 'CRM action']].map(([v, k]) => h('div', { class: 'stat' }, h('b', null, v), h('span', null, k)))),
        h('h4', null, 'Why now'), h('div', { class: 'why' }, c.why),
        h('div', { class: 'two' }, h('div', null, h('h4', null, 'CRM evidence'), ul(c.ev), h('h4', null, 'Use case'), h('div', null, c.use)), h('div', null, h('h4', null, 'Proof to lead with (Exhibit A)'), ul(c.proof))),
        h('div', { class: 'two' }, h('div', null, h('h4', null, 'Pilot scope'), ul(c.pilot)), h('div', null, h('h4', null, 'Excluded-use checks'), h('div', { class: 'excl' }, ul(c.excl)))),
        h('h4', null, 'Watch out for'), h('div', { class: 'risk' }, c.risk), h('div', { class: 'next' }, h('strong', null, 'Next step'), h('br'), c.next),
        h('p', { class: 'foot' }, 'Sources: Exhibit A (model capabilities and eval performance) and Exhibit B (CRM export). * BAA / health-data terms are a planning assumption, not stated in the case materials.')); })
        : [h('div', { class: 'empty' }, 'No cards match.')]));
    }
    search.addEventListener('input', draw);
    body.className = 'doc-layout';
    body.replaceChildren(h('nav', { class: 'toc', 'aria-label': 'Accounts' }, h('label', { class: 'field' }, 'Find a card', search), index), cards);
    draw();
  }

  function renderTracker() {
    body.className = '';
    const wrap = h('div');
    body.replaceChildren(h('div', { class: 'subnav' }, ['milestones', 'risks', 'decisions'].map((id) => h('a', { class: 'btn', href: `#${id}` }, id[0].toUpperCase() + id.slice(1)))), wrap);
    const state = { week: 0, owner: '' };
    const st = stakeholdersStore();
    offExtra = st.subscribe(({ data, error, changed }) => {
      setStatus(data, error);
      if (!data || (!changed && wrap.childElementCount)) return;
      const draw = () => {
        const S = data.stakeholders;
        const tasks = S.flatMap((o) => o.tasks.map((t) => ({ ...t, owner: o.name, team: o.team, urgency: o.urgency }))).filter((t) => (!state.week || (state.week >= t.start && state.week <= t.end)) && (!state.owner || t.owner === state.owner)).sort((a, b) => a.end - b.end);
        const table = (heads, rows) => h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, heads.map((t) => h('th', null, t)))), h('tbody', null, rows)));
        const sec = (id, title, note, ...kids) => h('section', { id, class: 'group' }, h('div', { class: 'group-head' }, h('h2', { style: { position: 'relative' } }, title), h('span', { class: 'stats' }, note), h('button', { class: 'btn ghost small', type: 'button', onClick: () => copyLink(`${path}#${id}`, 'Section link copied') }, 'Copy link')), ...kids);
        wrap.replaceChildren(
          data.source === 'snapshot' ? h('div', { class: 'notice' }, h('strong', null, 'Showing the built-in snapshot'), ` (${data.snapshotDate}). The stakeholder sheet could not be read.`) : '',
          sec('milestones', 'Owners & milestones', `${tasks.length} tasks`,
            h('div', { class: 'toolbar', style: { marginBottom: '12px' } },
              h('div', { class: 'seg small' }, [0, ...data.weeks.map((w) => w.n)].map((n) => h('button', { type: 'button', 'aria-pressed': String(state.week === n), onClick: () => { state.week = n; draw(); } }, n ? `Week ${n}` : 'All weeks'))),
              h('label', { class: 'field' }, 'Owner', h('select', { onChange: (e) => { state.owner = e.target.value; draw(); } }, h('option', { value: '' }, 'All owners'), S.map((o) => h('option', { value: o.name, selected: o.name === state.owner }, o.name))))),
            table(['Due', 'Owner', 'Team', 'Milestone', 'Urgency'], tasks.map((t) => h('tr', null, h('td', { class: 'name' }, t.due), h('td', null, t.owner), h('td', null, t.team), h('td', null, t.detail), h('td', null, h('span', { class: `pill u-${t.urgency.toLowerCase()}` }, t.urgency)))))),
          sec('risks', 'Risks', 'Expected pushback and the agreed resolution',
            table(['Risk', 'Owner', 'Pushback', 'Resolution', 'Needed by'], S.filter((o) => o.pushback).map((o) => h('tr', null, h('td', null, h('span', { class: `pill u-${(o.risk || '').toLowerCase()}` }, o.risk || '—')), h('td', { class: 'name' }, o.name), h('td', null, o.pushback), h('td', null, o.resolution), h('td', null, o.neededBy || o.deadline))))),
          sec('decisions', 'Decisions', 'Who owns which call, and by when',
            table(['Decision', 'Owner', 'Team', 'Deadline'], S.flatMap((o) => o.decisions.map((dcs) => h('tr', null, h('td', { class: 'name', style: { whiteSpace: 'normal' } }, dcs), h('td', null, o.name), h('td', null, o.team), h('td', null, o.deadline)))))));
        afterRender();
      };
      draw();
    });
  }

  const st = store(`/api/doc?slug=${encodeURIComponent(slug)}`);
  let rendered = false;
  const off = st.subscribe(({ data, error, changed }) => {
    if (data?.kind !== 'tracker') setStatus(data, error);
    if (!data) { if (error) body.replaceChildren(h('div', { class: 'empty' }, 'Could not load this document. Retrying…')); return; }
    if (data.error && !data.kind) { body.className = ''; body.replaceChildren(h('div', { class: 'empty' }, h('h3', null, 'Document not found'), h('a', { href: '/materials' }, 'Back to the Launch Materials Center'))); return; }
    if (rendered && !changed) return;
    renderHeader(data);
    if (data.kind === 'cards') renderCards(data);
    else if (data.kind === 'tracker') { if (!rendered) renderTracker(); }
    else { const y = window.scrollY; renderDoc(data); if (rendered) window.scrollTo(0, y); }
    rendered = true;
    if (data.kind !== 'tracker') afterRender();
  });
  return { refresh: (force) => { st.refresh(force); if (offExtra) stakeholdersStore().refresh(force); }, destroy() { off(); offExtra?.(); } };
}
