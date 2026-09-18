// Tiny DOM helpers (no framework, no build step).
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  setProps(el, props);
  append(el, children);
  return el;
}
const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}
function setProps(el, props) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v; // only ever used with server-sanitised document HTML
    else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) if (val != null) p.startsWith('--') ? el.style.setProperty(p, val) : (el.style[p] = val); }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && k !== 'list' && k !== 'form') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? '' : v);
  }
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

// Tooltip shared by charts and the timeline. Content is built with DOM nodes (never raw HTML).
const tip = () => document.getElementById('tooltip');
export function showTip(content, x, y) {
  const el = tip();
  el.replaceChildren(...[content].flat(Infinity).filter((c) => c != null && c !== false));
  el.hidden = false;
  const pad = 14;
  const { width, height } = el.getBoundingClientRect();
  let left = x + pad, top = y + pad;
  if (left + width > innerWidth - 8) left = Math.max(8, x - width - pad);
  if (top + height > innerHeight - 8) top = Math.max(8, y - height - pad);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
export function hideTip() { tip().hidden = true; }
export const tipRow = (k, v) => h('div', { class: 't-row' }, h('span', null, k), h('span', null, v));
/** Hover + keyboard focus + tap all open the same tooltip. */
export function bindTip(el, build) {
  const at = (e) => (e.clientX != null && e.type !== 'focus' ? [e.clientX, e.clientY] : (() => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.bottom]; })());
  el.addEventListener('mouseenter', (e) => showTip(build(), ...at(e)));
  el.addEventListener('mousemove', (e) => showTip(build(), ...at(e)));
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('focus', (e) => showTip(build(), ...at(e)));
  el.addEventListener('blur', hideTip);
  el.addEventListener('touchstart', (e) => { const t = e.touches[0]; showTip(build(), t.clientX, t.clientY); }, { passive: true });
}

/** Multi-select dropdown. options: [{value, label}], values: Set. onChange(Set) fires on every tick. */
export function multiSelect({ options, values, placeholder = 'None', label = 'Filter' }, onChange) {
  const summary = h('summary', { class: 'btn' });
  const menu = h('div', { class: 'dd-menu', role: 'group', 'aria-label': label });
  const dd = h('details', { class: 'dd' }, summary, menu);
  const paint = () => {
    const picked = options.filter((o) => values.has(o.value));
    summary.textContent = picked.length === 0 ? placeholder : picked.length === 1 ? picked[0].label : `${picked.length} selected`;
    summary.append(h('span', { class: 'dd-caret', 'aria-hidden': 'true' }, '▾'));
  };
  options.forEach((o) => menu.append(h('label', { class: 'dd-item' },
    h('input', { type: 'checkbox', checked: values.has(o.value), onChange: (e) => { e.target.checked ? values.add(o.value) : values.delete(o.value); paint(); onChange(values); } }), o.label)));
  menu.append(h('button', { class: 'btn ghost small', type: 'button', onClick: () => { values.clear(); menu.querySelectorAll('input').forEach((i) => { i.checked = false; }); paint(); onChange(values); } }, 'Clear'));
  document.addEventListener('click', (e) => { if (dd.open && !dd.contains(e.target)) dd.open = false; });
  paint();
  return dd;
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}
export async function copyLink(url, message = 'Link copied') {
  const full = new URL(url, location.origin).href;
  try { await navigator.clipboard.writeText(full); toast(message); }
  catch { window.prompt('Copy this link', full); }
}

/** Redraw a chart whenever its container changes width. */
export function responsive(el, draw) {
  let width = 0, frame;
  const ro = new ResizeObserver(() => {
    const w = Math.round(el.clientWidth);
    if (!w || w === width) return;
    width = w;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => draw(w));
  });
  ro.observe(el);
  return { redraw: () => { width = Math.round(el.clientWidth) || width || 900; draw(width); }, disconnect: () => ro.disconnect() };
}

export function ago(iso) {
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  return min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`;
}
