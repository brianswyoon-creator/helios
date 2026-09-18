// Pure data model shared by the browser and the tests.
// Every rule here mirrors a formula in the "Target Account List" Google Sheet (Dashboard tab),
// so the site and the sheet always agree. Nothing is hard-coded: all numbers come from the rows.

export const STATUSES = ['Wave 1', 'Wave 2', 'Disqualified', 'Requalify', 'Open New Helios Deal', 'Text-Only', 'On Hold'];
// Wave 1 and Wave 2 each split in two, exactly as the sheet's CRM tabs group them.
export const SUB_STATUSES = ['Wave 1 — Helios deal in play', 'Wave 1 — No Helios deal yet', 'Wave 2 — Opportunities in play', 'Wave 2 — On hold (EU data)', 'Disqualified', 'Requalify', 'Open New Helios Deal', 'Text-Only', 'On Hold'];
export const INDUSTRIES = ['FSI', 'HCLS', 'Legal', 'Logistics', 'E-commerce & Retail', 'AI & Developer Tools', 'CX & Support Software'];

// Waterfall removal steps, in sheet order. `bucket` matches the sheet's "Account bucket (helper)".
export const FILTERS = [
  { bucket: 'Text-only', kind: 'removed', short: 'Text-only', toggle: 'Text-only (no vision ask)', label: 'Text-only deals, with no vision ask in the deal' },
  { bucket: 'Medical', kind: 'removed', short: 'Medical images', toggle: 'Medical / scientific images', label: 'Medical or scientific images (prohibited)' },
  { bucket: 'Image gen', kind: 'removed', short: 'Image gen', toggle: 'Image generation', label: 'Image generation (not supported)' },
  { bucket: 'Real-time', kind: 'removed', short: 'Real-time', toggle: 'Real-time latency', label: 'Real-time needs (300ms and 1s requirements vs. ~6s)' },
  { bucket: 'EU patient', kind: 'removed', short: 'EU patient data', toggle: 'EU patient data', label: 'EU patient data that must stay in the EU' },
  { bucket: 'EMEA', kind: 'hold', short: 'EMEA vision', toggle: 'Hold: EMEA vision (EU rules unclear)', label: 'Hold: other EMEA vision deals (EU data rules unclear)' },
  { bucket: 'stalled', kind: 'hold', short: 'Stalled', toggle: 'Hold: stalled (no sponsor)', label: 'Hold: stalled deals with no sponsor' },
];

const has = (text, needle) => String(text || '').toLowerCase().includes(needle.toLowerCase());
const isEuHold = (a) => has(a.next, '(EU data)');
export const hasHeliosDeal = (a) => a.dealRev !== 'No Helios deal yet';
export const inPlay = (a) => (a.status === 'Wave 1' && hasHeliosDeal(a)) || (a.status === 'Wave 2' && !isEuHold(a));

export function bucketOf(a) {
  if (inPlay(a)) return 'Sellable';
  if (a.status === 'Wave 2') return 'EMEA';
  if (a.status === 'Requalify') return 'stalled';
  if (a.status === 'Disqualified') {
    if (has(a.next, 'medical/scientific')) return 'Medical';
    if (has(a.next, 'generate or edit images')) return 'Image gen';
    if (has(a.next, 'requires results in under')) return 'Real-time';
    if (has(a.next, 'patient data to stay in the EU')) return 'EU patient';
  }
  return 'Text-only';
}

export function tierOf(a) {
  const m = /^Tier ([ABC])/.exec(a.next || '');
  return m ? m[1] : '';
}

export function fitOf(a) {
  const sf = a.status === 'Wave 1' && hasHeliosDeal(a) ? 100
    : a.status === 'Wave 2' && !isEuHold(a) ? 85
    : a.status === 'Wave 2' ? 60
    : a.status === 'Wave 1' ? 55
    : a.status === 'Requalify' ? 45
    : a.status === 'Open New Helios Deal' ? 35
    : a.status === 'Disqualified' ? 10 : 0;
  const inf = a.industry === 'FSI' || a.industry === 'HCLS' ? 100 : a.industry === 'Legal' || a.industry === 'Logistics' ? 60 : 25;
  const rf = a.region === 'AMER' ? 100 : 40;
  return Math.round(0.6 * sf + 0.25 * inf + 0.15 * rf);
}

const TIMING = /renew|weeks?|months?|at launch|deadline|has budget|budget approved|budget signed|this quarter/;
export function urgencyOf(a) {
  const tier = tierOf(a);
  const t = tier === 'A' ? 100 : tier === 'B' ? 70 : tier === 'C' ? 45 : 20;
  const tm = TIMING.test(`${a.next} ${a.oppNotes}`.toLowerCase()) ? 100 : 0;
  const hold = a.status === 'Requalify' || isEuHold(a) || a.status === 'Disqualified' || a.status === 'Text-Only' || a.status === 'On Hold';
  return Math.round((0.6 * t + 0.4 * tm) * (hold ? 0.5 : 1));
}

export const sumM = (list) => list.reduce((s, a) => s + a.oppK, 0) / 1000;
export const sumRevM = (list) => list.reduce((s, a) => s + a.revenueK, 0) / 1000;
export const fmtM = (m, digits = 1) => `$${m.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}M`;
export const fmtK = (k) => `$${Math.round(k).toLocaleString('en-US')}K`;

export function subStatusOf(a) {
  if (a.status === 'Wave 1') return hasHeliosDeal(a) ? 'Wave 1 — Helios deal in play' : 'Wave 1 — No Helios deal yet';
  if (a.status === 'Wave 2') return isEuHold(a) ? 'Wave 2 — On hold (EU data)' : 'Wave 2 — Opportunities in play';
  return a.status;
}
export function enrich(accounts) {
  return accounts.map((a, i) => ({ ...a, i, bucket: bucketOf(a), subStatus: subStatusOf(a), tier: tierOf(a), fit: fitOf(a), urgency: urgencyOf(a), oppM: a.oppK / 1000 }));
}
/** Closed-won Helios deals: opportunity size of accounts whose status is "Closed Won" (none yet in the sheet). */
export const closedWon = (rows) => rows.filter((a) => /^closed[\s-]?won$/i.test(a.status));

/** Summary tiles: one per sub-status ($M and account count). */
export function tileSummary(rows) {
  const known = SUB_STATUSES.map((status) => { const list = rows.filter((a) => a.subStatus === status); return { status, m: sumM(list), n: list.length }; });
  const other = rows.filter((a) => !SUB_STATUSES.includes(a.subStatus));
  if (other.length) known.push({ status: 'Other', m: sumM(other), n: other.length });
  return known;
}

/** Status summary tiles: $M and account count per "Account Status for Helios GA". */
export function statusSummary(rows) {
  const known = STATUSES.map((status) => {
    const list = rows.filter((a) => a.status.toLowerCase() === status.toLowerCase());
    return { status, m: sumM(list), n: list.length };
  });
  const other = rows.filter((a) => !STATUSES.some((s) => s.toLowerCase() === a.status.toLowerCase()));
  if (other.length) known.push({ status: 'Other', m: sumM(other), n: other.length });
  return known;
}

/** Waterfall. `addBack` is a Set of bucket names whose filter is switched off (added back). */
export function waterfall(rows, addBack = new Set()) {
  const total = { m: sumM(rows), n: rows.length };
  const steps = [];
  let running = total.m;
  let count = total.n;
  const push = (s) => steps.push(s);
  push({ key: 'total', kind: 'total', label: 'Total pipeline', short: 'Total pipeline', from: 0, to: total.m, m: total.m, n: total.n });
  FILTERS.forEach((f, idx) => {
    const list = rows.filter((a) => a.bucket === f.bucket);
    const m = sumM(list);
    const added = addBack.has(f.bucket);
    const from = running;
    if (!added) { running -= m; count -= list.length; }
    push({ key: f.bucket, kind: added ? 'added' : f.kind, baseKind: f.kind, label: f.label, short: f.short, from, to: added ? from : running, m, n: list.length, added });
    if (idx === 0) push({ key: 'vision', kind: 'total', label: 'Deals asking for vision', short: 'Asking for vision', from: 0, to: running, m: running, n: count });
  });
  push({ key: 'sellable', kind: 'sellable', label: addBack.size ? 'Sellable at GA (scenario)' : 'Sellable at GA', short: 'Sellable at GA', from: 0, to: running, m: running, n: count });
  const w1 = rows.filter((a) => a.status === 'Wave 1' && hasHeliosDeal(a));
  const w2 = rows.filter((a) => a.status === 'Wave 2' && !isEuHold(a));
  const w1m = sumM(w1), w2m = sumM(w2);
  push({ key: 'wave1', kind: 'wave', label: 'Wave 1 pipeline (Helios deal in play)', short: 'Wave 1', from: 0, to: w1m, m: w1m, n: w1.length });
  push({ key: 'wave2', kind: 'wave', label: 'Wave 2 pipeline (opportunities in play, excl. EU data hold)', short: 'Wave 2', from: w1m, to: w1m + w2m, m: w2m, n: w2.length });
  const back = rows.filter((a) => addBack.has(a.bucket));
  if (back.length) {
    const bm = sumM(back);
    push({ key: 'addedback', kind: 'added', label: 'Added back by scenario (filters switched off)', short: 'Added back', from: w1m + w2m, to: w1m + w2m + bm, m: bm, n: back.length, summary: true });
  }
  return { steps, total, sellable: { m: running, n: count } };
}

/** Sellable at GA by industry: baseline (all filters on) + added back (scenario). */
export function byIndustry(rows, addBack = new Set()) {
  const names = [...INDUSTRIES, ...new Set(rows.map((a) => a.industry).filter((x) => x && !INDUSTRIES.includes(x)))];
  return names.map((industry) => {
    const list = rows.filter((a) => a.industry === industry);
    const base = list.filter((a) => a.bucket === 'Sellable');
    const added = list.filter((a) => addBack.has(a.bucket));
    return { industry, base: sumM(base), added: sumM(added), n: base.length + added.length, total: sumM(base) + sumM(added) };
  });
}

/** Scatter: weighted score, top 20, and the sheet's de-overlap jitter for top-20 points that coincide. */
export function scatter(rows, weights = { fit: 5, urgency: 5, size: 3 }) {
  const maxOpp = Math.max(...rows.map((a) => a.oppM), 0) || 1;
  const wsum = Math.max(1, weights.fit + weights.urgency + weights.size);
  const pts = rows.map((a) => {
    const score = Math.round(((weights.fit * a.fit + weights.urgency * a.urgency + weights.size * 100 * a.oppM / maxOpp) / wsum) * 10) / 10;
    return { ...a, score, adj: score + (1000 - (107 + a.i)) / 1e7 };
  });
  const ranked = [...pts].sort((p, q) => q.adj - p.adj);
  ranked.forEach((p, r) => { p.rank = r + 1; p.top = r < 20; });
  for (const p of pts) {
    p.x = p.fit; p.y = p.urgency;
    if (!p.top) continue;
    const same = pts.filter((q) => q.top && q.fit === p.fit && q.urgency === p.urgency);
    if (same.length > 1) {
      const n = same.length;
      const k = same.filter((q) => q.adj > p.adj).length;
      const radius = 6 + 2 * n;
      p.x = p.fit + radius * Math.cos((2 * Math.PI * k) / n + Math.PI / 4);
      p.y = p.urgency + radius * Math.sin((2 * Math.PI * k) / n + Math.PI / 4);
    }
  }
  return pts;
}

/** CRM views. Each returns groups: { title, rows } ranked by annual revenue, like the sheet tabs. */
const byRevenue = (list) => [...list].sort((a, b) => b.revenueK - a.revenueK || a.i - b.i).map((a, r) => ({ ...a, rank: r + 1 }));
function group(title, list, extra = '') {
  if (!list.length) return null;
  return { title, n: list.length, revM: sumRevM(list), oppM: sumM(list), extra, rows: byRevenue(list) };
}
export const VIEWS = [
  { id: 'prioritization', label: 'Target Account Prioritization', title: 'Target Account Prioritization — by Account Status for Helios GA (ranked by Annual revenue $K)' },
  { id: 'industry', label: 'By Industry', title: 'Target Accounts by Industry (ranked by Annual revenue $K)' },
  { id: 'wave-1', label: 'Wave 1', title: 'Wave 1 Accounts — ranked by Annual revenue ($K)' },
  { id: 'wave-2', label: 'Wave 2', title: 'Wave 2 Accounts — ranked by Annual revenue ($K)' },
];
export function crmGroups(rows, view) {
  const w1a = group('Wave 1 — Helios deal in play', rows.filter((a) => a.status === 'Wave 1' && hasHeliosDeal(a)));
  const w1b = group('Wave 1 — No Helios deal yet', rows.filter((a) => a.status === 'Wave 1' && !hasHeliosDeal(a)));
  const w2a = group('Wave 2 — Opportunities in play', rows.filter((a) => a.status === 'Wave 2' && !isEuHold(a)));
  const w2b = group('Wave 2 — On hold: EU data (pending Legal ruling)', rows.filter((a) => a.status === 'Wave 2' && isEuHold(a)));
  let out;
  if (view === 'wave-1') out = [w1a, w1b];
  else if (view === 'wave-2') out = [w2a, w2b];
  else if (view === 'industry') {
    const names = [...new Set(rows.map((a) => a.industry))].sort((a, b) => a.localeCompare(b));
    out = names.map((n) => {
      const list = rows.filter((a) => a.industry === n);
      return group(n, list, `${fmtM(sumM(list.filter(inPlay)))} in play (Wave 1 with Helios deal + Wave 2 non-EU)`);
    });
  } else {
    const rest = ['Disqualified', 'Requalify', 'Open New Helios Deal', 'Text-Only', 'On Hold'].map((s) => group(s, rows.filter((a) => a.status === s)));
    const known = new Set(STATUSES);
    const other = group('Other status', rows.filter((a) => !known.has(a.status)));
    out = [w1a, w1b, w2a, w2b, ...rest, other];
  }
  return out.filter(Boolean);
}

export const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
