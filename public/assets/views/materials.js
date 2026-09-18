// Launch Materials (WIP): every item folds open in place; the first one starts open.
import { h } from '../ui.js';
import { store, setStatus } from '../app.js';
import { renderMaterial } from './material.js';

export const wipBanner = () => h('div', { class: 'wip-banner', role: 'note' }, h('p', null, h('span', { class: 'badge' }, 'Work in progress'), 'These documents are drafts. Wording, numbers and scope may change before GA, so link to this page rather than saving copies.'));

export function downloads(m) {
  if (m.kind !== 'gdoc' && m.kind !== 'gsheet') return [];
  return [h('a', { class: 'btn', href: `/api/download?slug=${m.slug}&format=pdf`, download: '' }, 'Download .pdf')];
}

export function mount(root) {
  const list = h('ol', { class: 'mat-list' });
  root.replaceChildren(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Launch Materials'))), wipBanner(), list);
  const open = new Set();
  const subs = new Map(); // slug → unsubscribe for the item's content store
  let built = false;

  function item(m, i) {
    const path = `/materials/${m.slug}`;
    const body = h('div', { class: 'mat-body', hidden: true });
    const toggle = h('button', { class: 'fold', type: 'button', 'aria-expanded': 'false', 'aria-label': `Show ${m.title}` }, h('span', { class: 'fold-caret', 'aria-hidden': 'true' }, '▾'), h('span', { class: 'fold-text' }, 'Show'));
    const row = h('li', { class: 'mat', id: m.slug },
      h('div', { class: 'mat-head', onClick: (e) => { if (!e.target.closest('a')) setOpen(!open.has(m.slug)); } },
        h('div', { class: 'no-col' }, h('div', { class: 'no' }, String(i + 1).padStart(2, '0')), toggle),
        h('div', null, h('h3', null, h('a', { href: path, title: 'Open on its own page' }, m.title)), h('p', null, m.blurb), m.note ? h('div', { class: 'wip-note' }, m.note) : null),
        h('div', { class: 'actions' }, m.pdf === false ? null : downloads(m))),
      body);
    const opts = { inline: true };
    function setOpen(on) {
      on ? open.add(m.slug) : open.delete(m.slug);
      row.classList.toggle('is-open', on);
      toggle.setAttribute('aria-expanded', String(on));
      toggle.querySelector('.fold-text').textContent = on ? 'Hide' : 'Show';
      body.hidden = !on;
      if (on && !subs.has(m.slug)) {
        body.replaceChildren(h('div', { class: 'skeleton' }, 'Loading…'));
        const st = store(`/api/doc?slug=${encodeURIComponent(m.slug)}`);
        let drawn = false;
        subs.set(m.slug, st.subscribe(({ data, error, changed }) => {
          if (!data) { if (error && !drawn) body.replaceChildren(h('div', { class: 'empty' }, 'Could not load this document. Retrying…')); return; }
          if (drawn && !changed) return;
          renderMaterial(body, data, path, opts);
          drawn = true;
        }));
      }
    }
    return { row, setOpen };
  }

  const st = store('/api/materials');
  const off = st.subscribe(({ data, error }) => {
    setStatus(data ? { ...data, source: 'site', fetchedAt: new Date().toISOString() } : null, error);
    if (!data || built) return;
    built = true;
    const items = data.materials.map(item);
    list.replaceChildren(...items.map((x) => x.row));
    const wanted = decodeURIComponent(location.hash.slice(1));
    const start = items.find((x) => x.row.id === wanted) || items[0];
    if (start) { start.setOpen(true); if (wanted && start.row.id === wanted) requestAnimationFrame(() => start.row.scrollIntoView()); }
  });
  return { refresh: (force) => { st.refresh(force); for (const slug of open) store(`/api/doc?slug=${encodeURIComponent(slug)}`).refresh(force); }, destroy() { off(); subs.forEach((u) => u()); } };
}
