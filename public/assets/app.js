// App shell: router, live data stores (polling Google via the site's API), header status.
import { h, hideTip, ago } from './ui.js';

const POLL_MS = 15000;

/** A live data source: polls, refreshes on focus, keeps the last good payload if a request fails. */
function createStore(url) {
  let data = null, error = null, sig = '', timer = null, inflight = null;
  const subs = new Set();
  const emit = (changed) => subs.forEach((fn) => fn({ data, error, changed }));
  async function refresh(force = false) {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const res = await fetch(force ? `${url}${url.includes('?') ? '&' : '?'}fresh=${Date.now()}` : url, { headers: { accept: 'application/json' } });
        if (res.status === 401) { location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}${location.hash}`; return; }
        if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
        const next = await res.json();
        const { fetchedAt, ...rest } = next;
        const nextSig = JSON.stringify(rest);
        const changed = nextSig !== sig;
        sig = nextSig; data = next; error = null;
        emit(changed);
      } catch (err) { error = err; emit(false); }
      finally { inflight = null; }
    })();
    return inflight;
  }
  function start() { if (!timer) { refresh(); timer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS); } }
  function stop() { clearInterval(timer); timer = null; }
  return {
    get: () => data,
    refresh,
    subscribe(fn) { subs.add(fn); start(); if (data) fn({ data, error, changed: true }); return () => { subs.delete(fn); if (!subs.size) stop(); }; },
  };
}
const stores = new Map();
export function store(url) {
  if (!stores.has(url)) stores.set(url, createStore(url));
  return stores.get(url);
}
export const accountsStore = () => store('/api/accounts');
export const stakeholdersStore = () => store('/api/stakeholders');

// ---- header status -------------------------------------------------------
const liveBtn = document.getElementById('live');
const liveText = document.getElementById('live-text');
let lastStatus = null;
export function setStatus(payload, error) {
  lastStatus = { payload, error };
  paintStatus();
}
function paintStatus() {
  if (!lastStatus) return;
  const { payload, error } = lastStatus;
  if (error && !payload) { liveBtn.dataset.state = 'error'; liveText.textContent = 'Offline · retrying'; return; }
  if (!payload) return;
  const state = payload.source === 'live' ? 'live' : payload.source === 'site' ? 'live' : 'snapshot';
  liveBtn.dataset.state = error ? 'error' : state;
  liveText.textContent = error ? `Reconnecting · last update ${ago(payload.fetchedAt)}`
    : payload.source === 'live' ? `Live · updated ${ago(payload.fetchedAt)}`
    : payload.source === 'site' ? 'Built-in content'
    : payload.source === 'unavailable' ? 'Google Doc not reachable'
    : 'Snapshot · Google Sheet not reachable';
  liveBtn.title = payload.error ? `${payload.error}\nClick to retry now.` : 'Click to refresh from Google now';
}
setInterval(paintStatus, 5000);
let currentRefresh = () => {};
liveBtn.addEventListener('click', () => { liveText.textContent = 'Refreshing…'; currentRefresh(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) currentRefresh(false); });
window.addEventListener('focus', () => currentRefresh(false));

// ---- router --------------------------------------------------------------
const routes = [
  { re: /^\/pipeline\/?$/, tab: 'pipeline', title: 'Pipeline Dashboard', load: () => import('./views/pipeline.js') },
  { re: /^\/crm\/?$/, tab: 'crm', title: 'CRM', load: () => import('./views/crm.js') },
  { re: /^\/stakeholders\/?$/, tab: 'stakeholders', title: 'Stakeholder Collaboration', load: () => import('./views/stakeholders.js') },
  { re: /^\/materials\/?$/, tab: 'materials', title: 'Enablement Materials (WIP)', load: () => import('./views/materials.js') },
  { re: /^\/materials\/([\w-]+)\/?$/, tab: 'materials', title: 'Enablement Materials (WIP)', load: () => import('./views/material.js') },
];
const main = document.getElementById('main');
let current = null, currentPath = null, currentKey = null;

export function navigate(url, { replace = false } = {}) {
  const target = new URL(url, location.origin);
  if (target.pathname === location.pathname && target.search === location.search && target.hash) {
    location.hash = target.hash; return; // same page: let the browser jump to the section
  }
  history[replace ? 'replaceState' : 'pushState'](null, '', target.pathname + target.search + target.hash);
  render();
}
/** Update the query string without re-rendering (used to keep filters shareable). */
export function setQuery(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) q.set(k, Array.isArray(v) ? v.join(',') : v);
  const qs = q.toString();
  history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  currentKey = location.pathname + location.search;
}
export function scrollToHash() {
  if (!location.hash) return;
  const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (el) { el.scrollIntoView(); if (el.dataset.open) el.dispatchEvent(new CustomEvent('deeplink')); }
}

async function render() {
  const path = location.pathname === '/' || location.pathname === '/index.html' ? '/pipeline' : location.pathname;
  const route = routes.find((r) => r.re.test(path));
  const key = path + location.search;
  if (currentKey === key && current) return;
  hideTip();
  current?.destroy?.();
  current = null; currentPath = path; currentKey = key;
  document.querySelectorAll('#tabs a').forEach((a) => (a.dataset.tab === route?.tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (!route) {
    main.replaceChildren(h('div', { class: 'empty' }, h('h2', null, 'Page not found'), h('p', null, h('a', { href: '/pipeline', 'data-link': '' }, 'Go to the Pipeline Dashboard'))));
    return;
  }
  document.title = `${route.title} · Helios Launch Hub`;
  main.replaceChildren(h('div', { class: 'skeleton' }, 'Loading…'));
  try {
    const mod = await route.load();
    if (currentPath !== path) return;
    const view = mod.mount(main, { params: route.re.exec(path).slice(1), query: new URLSearchParams(location.search) });
    current = view;
    currentRefresh = (force = true) => view.refresh?.(force);
    if (!location.hash) window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('div', { class: 'empty' }, h('h2', null, 'Something went wrong loading this page'), h('p', { class: 'muted' }, String(err.message || err)), h('button', { class: 'btn', onClick: () => location.reload() }, 'Reload')));
  }
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  const url = new URL(a.href, location.origin);
  if (url.origin !== location.origin || !routes.some((r) => r.re.test(url.pathname))) return;
  e.preventDefault();
  navigate(url.href);
});
window.addEventListener('popstate', render);
window.addEventListener('scroll', hideTip, { passive: true });
render();
