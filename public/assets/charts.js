// Hand-drawn SVG charts: no chart library to load or break. Every chart draws from the rows it is
// given, tolerates empty data, has a hover/focus tooltip, a legend and visible value labels.
import { s, h, bindTip, tipRow } from './ui.js';
import { fmtM } from './model.js';

const COLORS = { total: 'var(--c-total)', removed: 'var(--c-removed)', hold: 'var(--c-hold)', sellable: 'var(--c-sellable)', wave: 'var(--c-wave)', added: 'url(#hatch)' };
const KIND_LABEL = { total: 'Total / subtotal', removed: 'Removed', hold: 'On hold', sellable: 'Sellable at GA', wave: 'Wave pipeline', added: 'Added back (scenario)' };

function niceMax(v) {
  if (!(v > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}
const ticks = (max, n = 5) => Array.from({ length: n + 1 }, (_, i) => (max / n) * i);
const hatchDefs = () => s('defs', null, s('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
  s('rect', { width: 6, height: 6, fill: 'var(--tint-blue)' }), s('rect', { width: 2.5, height: 6, fill: 'var(--c-wave)' })));
function wrapLabel(text, maxChars) {
  const words = String(text).split(' ');
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + ' ' + w).length > maxChars) lines.push(w); else lines[lines.length - 1] = cur ? `${cur} ${w}` : w;
  }
  return lines.slice(0, 3);
}
export function legend(kinds) {
  return h('div', { class: 'legend' }, kinds.map((k) => h('span', null, h('i', k === 'added' ? { class: 'hatch' } : { style: { background: COLORS[k] } }), KIND_LABEL[k])));
}
function emptyState(el, text = 'No data to chart yet.') { el.replaceChildren(h('div', { class: 'empty' }, text)); }

/** Pipeline waterfall (vertical floating columns). */
export function drawWaterfall(el, wf, width) {
  const steps = wf?.steps || [];
  if (!steps.length || !(wf.total.m > 0)) return emptyState(el);
  const W = Math.max(width, 760), H = 400, m = { t: 30, r: 12, b: 92, l: 52 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = niceMax(wf.total.m);
  const y = (v) => m.t + ih - (v / max) * ih;
  const band = iw / steps.length;
  const bw = Math.min(64, band * 0.62);
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Pipeline waterfall from total pipeline to sellable at GA' }, hatchDefs());
  for (const t of ticks(max)) {
    svg.append(s('line', { class: t ? 'grid' : 'base', x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }));
    svg.append(s('text', { x: m.l - 8, y: y(t) + 4, 'text-anchor': 'end' }, `$${Math.round(t)}`));
  }
  svg.append(s('text', { class: 'axis-title', x: m.l - 8, y: 14, 'text-anchor': 'end' }, '$M'));
  steps.forEach((st, i) => {
    const cx = m.l + band * i + band / 2, x = cx - bw / 2;
    const top = y(Math.max(st.from, st.to)), bottom = y(Math.min(st.from, st.to));
    const isDrop = st.baseKind && !st.summary;
    // An added-back step is drawn where it *would* have been removed, hatched, without lowering the running total.
    const ghostTop = st.added && isDrop ? y(st.from) : top;
    const ghostBottom = st.added && isDrop ? y(st.from - st.m) : bottom;
    const rectTop = st.added && isDrop ? ghostTop : top;
    const rectH = Math.max(2, (st.added && isDrop ? ghostBottom : bottom) - rectTop);
    const g = s('g', { tabindex: 0, role: 'listitem', 'aria-label': `${st.label}: ${fmtM(st.m)}, ${st.n} accounts` });
    g.append(s('rect', { class: 'mark', x, y: rectTop, width: bw, height: rectH, rx: 1, fill: COLORS[st.kind] }));
    const sign = isDrop && !st.added ? '−' : st.added && isDrop ? '+' : '';
    g.append(s('text', { class: 'val', x: cx, y: rectTop - 7, 'text-anchor': 'middle' }, `${sign}${fmtM(st.m).replace('M', '')}`));
    wrapLabel(st.short, Math.max(9, Math.floor(band / 7))).forEach((line, li) => g.append(s('text', { x: cx, y: H - m.b + 18 + li * 15, 'text-anchor': 'middle' }, line)));
    g.append(s('text', { x: cx, y: H - 10, 'text-anchor': 'middle', style: 'fill:var(--ink-3);font-size:12px' }, `${st.n} accts`));
    g.append(s('rect', { class: 'hit', x: cx - band / 2, y: m.t, width: band, height: ih + 60 }));
    bindTip(g, () => [h('b', null, st.label), tipRow('Pipeline', fmtM(st.m)), tipRow('Accounts', String(st.n)), tipRow('Share of total', `${((st.m / wf.total.m) * 100).toFixed(1)}%`),
      st.added ? h('div', { class: 't-note' }, 'Filter switched off: this pipeline is added back into the scenario.') : null]);
    svg.append(g);
    const nxt = steps[i + 1];
    if (nxt && i < steps.findIndex((q) => q.key === 'sellable')) {
      const level = y(st.to);
      svg.append(s('line', { class: 'connector', x1: x + bw, x2: cx + band - bw / 2, y1: level, y2: level }));
    }
  });
  el.replaceChildren(svg);
}

/** Sellable at GA by industry: horizontal stacked bars (baseline + added back). */
export function drawIndustry(el, rows, width) {
  if (!rows?.length) return emptyState(el);
  const W = Math.max(width, 420), rowH = 40, m = { t: 8, r: 118, b: 30, l: 158 };
  const H = m.t + m.b + rowH * rows.length;
  const iw = W - m.l - m.r;
  const max = niceMax(Math.max(...rows.map((r) => r.total), 1));
  const x = (v) => m.l + (v / max) * iw;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Sellable at GA by industry' }, hatchDefs());
  for (const t of ticks(max, 4)) {
    svg.append(s('line', { class: t ? 'grid' : 'base', x1: x(t), x2: x(t), y1: m.t, y2: H - m.b }));
    svg.append(s('text', { x: x(t), y: H - m.b + 16, 'text-anchor': 'middle' }, `$${t % 1 ? t.toFixed(1) : t}`));
  }
  rows.forEach((r, i) => {
    const cy = m.t + rowH * i + rowH / 2, bh = 18;
    const g = s('g', { tabindex: 0, 'aria-label': `${r.industry}: ${fmtM(r.total)}, ${r.n} accounts` });
    g.append(s('text', { x: m.l - 10, y: cy + 4, 'text-anchor': 'end', style: 'fill:var(--ink)' }, r.industry));
    if (r.base > 0) g.append(s('rect', { class: 'mark', x: x(0), y: cy - bh / 2, width: Math.max(2, x(r.base) - x(0)), height: bh, rx: 1, fill: COLORS.sellable }));
    if (r.added > 0) g.append(s('rect', { class: 'mark', x: x(r.base) + (r.base > 0 ? 2 : 0), y: cy - bh / 2, width: Math.max(2, x(r.base + r.added) - x(r.base) - (r.base > 0 ? 2 : 0)), height: bh, rx: 1, fill: COLORS.added }));
    g.append(s('text', { class: r.total > 0 ? 'val' : '', x: x(r.total) + 8, y: cy + 4 }, r.total > 0 ? `${fmtM(r.total)} · ${r.n} acct${r.n === 1 ? '' : 's'}` : '—'));
    g.append(s('rect', { class: 'hit', x: 0, y: cy - rowH / 2, width: W, height: rowH }));
    bindTip(g, () => [h('b', null, r.industry), tipRow('Sellable at GA (baseline)', fmtM(r.base)), tipRow('Added back (scenario)', fmtM(r.added)), tipRow('Total', fmtM(r.total)), tipRow('Accounts', String(r.n))]);
    svg.append(g);
  });
  el.replaceChildren(svg);
}

/** Account scatter: fit (x) vs urgency (y), bubble area = deal size, top 20 highlighted and labelled. */
export function drawScatter(el, pts, width, { dimmed = () => false, labels = true, onPick, yKey = 'urgency', sizeKey = 'oppM' } = {}) {
  if (!pts?.length) return emptyState(el);
  const W = Math.max(width, 480), H = Math.round(Math.min(720, Math.max(460, W * 0.56))), m = { t: 30, r: 26, b: 46, l: 52 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, DOMAIN = 124;
  const x = (v) => m.l + (Math.max(0, v) / DOMAIN) * iw, y = (v) => m.t + ih - (Math.max(0, v) / DOMAIN) * ih;
  const sizeOf = (p) => (sizeKey === 'score' ? p.score : p.oppM);
  const maxSize = Math.max(...pts.map(sizeOf), 0.1);
  const r = (p) => 4 + 20 * Math.sqrt(Math.max(0, sizeOf(p)) / maxSize);
  const py = (p) => (yKey === 'score' ? p.score : p.y);
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Account scatter: fit versus urgency, bubble size is deal size' });
  for (const t of [0, 20, 40, 60, 80, 100]) {
    svg.append(s('line', { class: t ? 'grid' : 'base', x1: x(t), x2: x(t), y1: m.t, y2: H - m.b }), s('line', { class: t ? 'grid' : 'base', x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }));
    svg.append(s('text', { x: x(t), y: H - m.b + 16, 'text-anchor': 'middle' }, t), s('text', { x: m.l - 8, y: y(t) + 4, 'text-anchor': 'end' }, t));
  }
  svg.append(s('text', { class: 'axis-title', x: m.l + iw / 2, y: H - 8, 'text-anchor': 'middle' }, 'Fit (status, launch vertical, AMER)'));
  svg.append(s('text', { class: 'axis-title', transform: `translate(14 ${m.t + ih / 2}) rotate(-90)`, 'text-anchor': 'middle' }, yKey === 'score' ? 'Weighted score (0–100)' : 'Urgency (tier, timing, holds)'));
  // Accounts with identical fit and urgency sit on the same spot. The sheet spreads the top 20 apart; the
  // chart does the same for the rest (display only), so every bubble and its name can be seen.
  const stacks = new Map();
  for (const p of pts) if (!p.top) { const k = `${p.x}|${py(p)}`; stacks.set(k, [...(stacks.get(k) || []), p]); }
  const shift = new Map();
  for (const group of stacks.values()) {
    if (group.length < 2) continue;
    // Spread in pixels (small ring, capped) so a stack stays recognisably near its true position.
    const n = group.length, radius = Math.min(44, 12 + 2.2 * n);
    group.sort((a, b) => b.oppM - a.oppM).forEach((p, k) => {
      const ang = (2 * Math.PI * k) / n + Math.PI / 4;
      const cx0 = x(p.x), cy0 = y(py(p));
      shift.set(p, [Math.max(m.l + 8, Math.min(W - m.r - 8, cx0 + radius * Math.cos(ang))) - cx0, Math.max(m.t + 8, Math.min(m.t + ih - 8, cy0 - radius * Math.sin(ang))) - cy0]);
    });
  }
  // Big bubbles first so small ones stay reachable; top 20 above the rest.
  const order = [...pts].sort((a, b) => (a.top - b.top) || (b.oppM - a.oppM));
  const placed = [];
  const labelNodes = [];
  for (const p of order) {
    const [dx, dy] = shift.get(p) || [0, 0];
    const cx = x(p.x) + dx, cy = y(py(p)) + dy, rad = r(p), dim = dimmed(p);
    const g = s('g', { class: 'pt', tabindex: p.top ? 0 : -1, opacity: dim ? 0.12 : 1, 'aria-label': `${p.name}: fit ${p.fit}, urgency ${p.urgency}, ${fmtM(p.oppM)}` });
    g.append(s('circle', { cx, cy, r: rad, fill: p.top ? 'var(--c-removed)' : 'var(--c-other)', 'fill-opacity': p.top ? 0.82 : 0.45, stroke: 'var(--bg)', 'stroke-width': 1.5 }));
    bindTip(g, () => [h('b', null, p.top ? `#${p.rank} · ${p.name}` : p.name), tipRow('Status', p.status), tipRow('Industry · region', `${p.industry} · ${p.region}`), tipRow('Owner', p.owner),
      tipRow('Opportunity', fmtM(p.oppM)), tipRow('Fit', String(p.fit)), tipRow('Urgency', String(p.urgency)), tipRow('Weighted score', `${p.score.toFixed(1)} (rank ${p.rank})`)]);
    if (onPick) { g.addEventListener('click', () => onPick(p)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter') onPick(p); }); }
    svg.append(g);
    if (labels && !dim) labelNodes.push({ p, cx, cy, rad });
  }
  // Label every account (top 20 first so they get the best spots), trying positions around each bubble and keeping the first free one.
  labelNodes.sort((a, b) => a.p.rank - b.p.rank);
  for (const n of labelNodes) placed.push({ l: n.cx - n.rad, r: n.cx + n.rad, t: n.cy - n.rad, b: n.cy + n.rad, own: n.p });
  for (const { p, cx, cy, rad } of labelNodes) {
    const text = p.top ? `${p.rank}. ${p.name.split(/\s+/)[0]}` : p.name.split(/\s+/)[0];
    const w = text.length * (p.top ? 6.4 : 5.9) + 4, hgt = p.top ? 14 : 13;
    const options = [[cx + rad + 4, cy + 4, 'start'], [cx - rad - 4, cy + 4, 'end'], [cx, cy - rad - 5, 'middle'], [cx, cy + rad + 14, 'middle'],
      [cx + rad * 0.75 + 3, cy - rad * 0.75, 'start'], [cx + rad * 0.75 + 3, cy + rad * 0.75 + 10, 'start'], [cx - rad * 0.75 - 3, cy - rad * 0.75, 'end'], [cx - rad * 0.75 - 3, cy + rad * 0.75 + 10, 'end'],
      [cx + rad + 4, cy - 10, 'start'], [cx + rad + 4, cy + 18, 'start'], [cx - rad - 4, cy - 10, 'end'], [cx - rad - 4, cy + 18, 'end'], [cx, cy - rad - 19, 'middle'], [cx, cy + rad + 28, 'middle']];
    let pick = options[0], free = false;
    for (const o of options) {
      const left = o[2] === 'start' ? o[0] : o[2] === 'end' ? o[0] - w : o[0] - w / 2;
      const box = { l: left, r: left + w, t: o[1] - hgt + 2, b: o[1] + 2 };
      if (box.l < m.l - 40 || box.r > W - 2 || box.t < 0) continue;
      if (!placed.some((q) => q.own !== p && box.l < q.r && box.r > q.l && box.t < q.b && box.b > q.t)) { pick = o; placed.push(box); free = true; break; }
    }
    // A label with no free spot is still drawn, lighter, so every account stays identifiable.
    svg.append(s('text', { class: `pt-label${p.top ? '' : ' other'}`, opacity: free ? 1 : 0.55, x: pick[0], y: pick[1], 'text-anchor': pick[2] }, text));
  }
  el.replaceChildren(svg);
}
