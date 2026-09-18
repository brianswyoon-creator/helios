// One Launch Materials document: live Google Doc reader, AE account cards, or the launch tracker.
import { h, copyLink } from '../ui.js';
import { store, setStatus, scrollToHash } from '../app.js';
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
  let first = true;
  const afterRender = () => { if (first) { first = false; requestAnimationFrame(scrollToHash); } };

  function renderHeader(d) {
    document.title = `${d.title} · Helios Launch Hub`;
    header.replaceChildren(
      h('div', { class: 'page-head', style: { marginBottom: '18px' } },
        h('div', null, h('h1', null, d.title), h('p', { class: 'lede' }, d.blurb)),
        h('div', { class: 'doc-actions' }, downloads(d))),
      wipBanner());
  }

  function renderDoc(d) {
    if (d.source === 'unavailable') {
      body.className = '';
      body.replaceChildren(h('div', { class: 'empty' }, h('h3', null, `This Google ${d.kind === 'gsheet' ? 'Sheet' : 'Doc'} can’t be read yet`), h('p', null, 'Share it as “Anyone with the link: Viewer” and it will appear here automatically within a few seconds.'),
        h('p', { class: 'small muted' }, d.error), h('a', { class: 'btn', href: d.docUrl, target: '_blank', rel: 'noopener' }, `Open in Google ${d.kind === 'gsheet' ? 'Sheets' : 'Docs'}`)));
      return;
    }
    const article = h('article', { class: 'doc', html: d.html }); // server-sanitised HTML (see lib/sanitize.js)
    article.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]').forEach((el) => el.prepend(anchorBtn(path, el.id)));
    const top = Math.min(...d.headings.map((x) => x.level), 6);
    const toc = d.headings.filter((x) => x.level - top < 3);
    body.className = 'doc-layout';
    body.replaceChildren(
      h('nav', { class: 'toc', 'aria-label': 'On this page' }, h('h4', null, 'On this page'), toc.length ? toc.map((x) => h('a', { class: `l${x.level - top + 1}`, href: `#${x.id}` }, x.text)) : h('span', { class: 'muted small' }, 'No headings'),
        h('p', { class: 'small muted', style: { marginTop: '14px' } }, `${d.words.toLocaleString('en-US')} words`)),
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

  let sheetTab = decodeURIComponent(location.hash.slice(1)) || '';
  function renderSheet(d) {
    body.className = '';
    if (d.source === 'unavailable') return renderDoc(d);
    const tabs = d.tabs || [];
    if (!tabs.some((t) => slugify(t.name) === sheetTab)) sheetTab = tabs[0] ? slugify(tabs[0].name) : '';
    const nav = h('div', { class: 'seg big', role: 'tablist' }, tabs.map((t) => h('button', { type: 'button', role: 'tab', 'aria-pressed': String(slugify(t.name) === sheetTab), onClick: () => { sheetTab = slugify(t.name); history.replaceState(null, '', `#${sheetTab}`); renderSheet(d); } }, t.name)));
    const t = tabs.find((x) => slugify(x.name) === sheetTab);
    const cell = (v) => h('td', { style: { whiteSpace: 'pre-line' } }, v);
    body.replaceChildren(nav, !t ? h('div', { class: 'empty' }, 'This sheet has no readable tabs.') : h('div', { style: { marginTop: '16px' } },
      t.title ? h('p', { class: 'muted small' }, t.title) : null,
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, t.header.map((x) => h('th', null, x)))),
        h('tbody', null, t.rows.map((r) => h('tr', null, r.map(cell))))))));
  }

  const st = store(`/api/doc?slug=${encodeURIComponent(slug)}`);
  let rendered = false;
  const off = st.subscribe(({ data, error, changed }) => {
    setStatus(data, error);
    if (!data) { if (error) body.replaceChildren(h('div', { class: 'empty' }, 'Could not load this document. Retrying…')); return; }
    if (data.error && !data.kind) { body.className = ''; body.replaceChildren(h('div', { class: 'empty' }, h('h3', null, 'Document not found'), h('a', { href: '/materials' }, 'Back to the Launch Materials Center'))); return; }
    if (rendered && !changed) return;
    renderHeader(data);
    if (data.kind === 'cards') renderCards(data);
    else if (data.kind === 'gsheet') renderSheet(data);
    else { const y = window.scrollY; renderDoc(data); if (rendered) window.scrollTo(0, y); }
    rendered = true;
    afterRender();
  });
  return { refresh: (force) => st.refresh(force), destroy: off };
}
