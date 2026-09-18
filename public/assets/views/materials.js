// Launch Materials Center (WIP): catalogue of enablement documents with read, download and share links.
import { h, copyLink } from '../ui.js';
import { store, setStatus } from '../app.js';

export const wipBanner = () => h('div', { class: 'wip-banner', role: 'note' }, h('p', null, h('span', { class: 'badge' }, 'Work in progress'), 'These documents are drafts. Wording, numbers and scope may change before GA, so link to this page rather than saving copies.'));

export function downloads(m) {
  const link = (format, label) => h('a', { class: 'btn', href: `/api/download?slug=${m.slug}&format=${format}`, download: '' }, label);
  if (m.kind === 'gdoc') return [link('docx', 'Download .docx'), link('pdf', 'Download .pdf')];
  if (m.kind === 'cards') return [link('md', 'Download .md'), h('a', { class: 'btn', href: '/downloads/helios-ae-account-cards.html', download: 'helios-ae-account-cards.html' }, 'Download .html')];
  return [link('csv', 'Download .csv')];
}

export function mount(root) {
  const list = h('ol', { class: 'mat-list' });
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('div', null, h('div', { class: 'eyebrow' }, 'Enablement Materials · WIP'), h('h1', null, 'Launch Materials Center'),
      h('p', { class: 'lede' }, 'Draft launch documents, in reading order.'))),
    wipBanner(), list);
  const st = store('/api/materials');
  const off = st.subscribe(({ data, error }) => {
    setStatus(data ? { ...data, source: 'site', fetchedAt: new Date().toISOString() } : null, error);
    if (!data) return;
    list.replaceChildren(...data.materials.map((m, i) => h('li', { class: 'mat', id: m.slug },
      h('div', { class: 'no' }, String(i + 1).padStart(2, '0')),
      h('div', null, h('h3', null, h('a', { href: `/materials/${m.slug}` }, m.title)), h('p', null, m.blurb),
        h('div', { class: 'kind' }, m.kind === 'gdoc' ? 'Google Doc' : m.kind === 'tracker' ? 'From the Helios Stakeholder Plan sheet' : '20 cards')),
      h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: `/materials/${m.slug}` }, 'Read'), downloads(m),
        h('button', { class: 'btn', type: 'button', onClick: () => copyLink(`/materials/${m.slug}`) }, 'Copy link')))));
  });
  return { refresh: (force) => st.refresh(force), destroy: off };
}
