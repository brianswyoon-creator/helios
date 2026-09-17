// Launch Materials Center (WIP): catalogue of enablement documents with read, download and share links.
import { h, copyLink } from '../ui.js';
import { store, setStatus } from '../app.js';

export const wipBanner = () => h('div', { class: 'wip-banner', role: 'note' }, h('span', { class: 'badge' }, 'WORK IN PROGRESS'),
  h('p', null, h('strong', null, 'Launch Materials Center — draft. '), 'These materials are still being written and reviewed. Wording, numbers and scope may change before GA; always open the latest version here rather than saving copies.'));

export function downloads(m) {
  const link = (format, label) => h('a', { class: 'btn', href: `/api/download?slug=${m.slug}&format=${format}`, download: '' }, `↓ ${label}`);
  if (m.kind === 'gdoc') return [link('docx', 'Word'), link('pdf', 'PDF')];
  if (m.kind === 'cards') return [link('md', 'Markdown'), h('a', { class: 'btn', href: '/downloads/helios-ae-account-cards.html', download: 'helios-ae-account-cards.html' }, '↓ HTML')];
  return [link('csv', 'CSV')];
}

export function mount(root) {
  const list = h('ol', { class: 'mat-list' });
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('div', null, h('div', { class: 'eyebrow' }, 'Enablement Materials · WIP'), h('h1', null, 'Launch Materials Center'),
      h('p', { class: 'lede' }, 'Everything sellers and partner teams need for the Helios GA launch, in the order to read it. Each document opens inside this site, can be downloaded, and has its own link you can paste into an email.'))),
    wipBanner(), list);
  const st = store('/api/materials');
  const off = st.subscribe(({ data, error }) => {
    setStatus(data ? { ...data, source: 'site', fetchedAt: new Date().toISOString() } : null, error);
    if (!data) return;
    list.replaceChildren(...data.materials.map((m, i) => h('li', { class: 'mat', id: m.slug },
      h('div', { class: 'no' }, String(i + 1).padStart(2, '0')),
      h('div', null, h('h3', null, h('a', { href: `/materials/${m.slug}` }, m.title)), h('p', null, m.blurb),
        h('div', { class: 'kind' }, m.kind === 'gdoc' ? 'Google Doc · updates live' : m.kind === 'tracker' ? 'Built from the stakeholder plan sheet · updates live' : 'Interactive cards · built into this site')),
      h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: `/materials/${m.slug}` }, 'Read'), downloads(m),
        h('button', { class: 'btn', type: 'button', onClick: () => copyLink(`/materials/${m.slug}`) }, 'Copy link')))));
  });
  return { refresh: (force) => st.refresh(force), destroy: off };
}
