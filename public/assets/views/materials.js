// Launch Materials Center (WIP): catalogue of enablement documents with read, download and share links.
import { h } from '../ui.js';
import { store, setStatus, navigate } from '../app.js';

export const wipBanner = () => h('div', { class: 'wip-banner', role: 'note' }, h('p', null, h('span', { class: 'badge' }, 'Work in progress'), 'These documents are drafts. Wording, numbers and scope may change before GA, so link to this page rather than saving copies.'));

export function downloads(m) {
  if (m.kind !== 'gdoc' && m.kind !== 'gsheet') return [];
  return [h('a', { class: 'btn', href: `/api/download?slug=${m.slug}&format=pdf`, download: '' }, 'Download .pdf')];
}

export function mount(root) {
  const list = h('ol', { class: 'mat-list' });
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Launch Materials'))),
    wipBanner(), list);
  const st = store('/api/materials');
  const off = st.subscribe(({ data, error }) => {
    setStatus(data ? { ...data, source: 'site', fetchedAt: new Date().toISOString() } : null, error);
    if (!data) return;
    list.replaceChildren(...data.materials.map((m, i) => {
      const href = `/materials/${m.slug}`;
      // The whole row opens the page; the PDF button is the one exception.
      const row = h('li', { class: 'mat', id: m.slug, onClick: (e) => { if (!e.target.closest('a')) navigate(href); } },
        h('div', { class: 'no' }, String(i + 1).padStart(2, '0')),
        h('div', null, h('h3', null, h('a', { href }, m.title)), h('p', null, m.blurb), m.note ? h('div', { class: 'wip-note' }, m.note) : null),
        h('div', { class: 'actions' }, h('a', { class: 'btn primary open', href }, 'Open page →'), m.pdf === false ? null : downloads(m)));
      return row;
    }));
  });
  return { refresh: (force) => st.refresh(force), destroy: off };
}
