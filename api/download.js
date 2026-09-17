// File downloads for the Launch Materials Center. Google Docs are exported on demand (always the latest version).
import { bySlug } from '../lib/materials.js';
import { fetchDocDownload } from '../lib/google.js';
import { loadStakeholders } from '../lib/live.js';
import cards from '../data/ae-cards.js';

const file = (body, type, name) => new Response(body, { headers: { 'content-type': type, 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
const money = (k) => (k == null ? 'n/a' : `$${(k / 1000).toFixed(1)}M`);
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function cardsMarkdown() {
  const list = (items) => items.map((x) => `- ${x}`).join('\n');
  const tiers = { A: 'Tier A · budget or launch-week start', B: 'Tier B · explicit Helios ask', C: 'Tier C · pain in notes, no deal yet' };
  return `# Helios AE Account Cards\n\nWave 1 target accounts: why now, the CRM evidence, the pilot and what not to sell.\n\n` + cards.map((d) => [
    `## ${d.name}`,
    `**${tiers[d.tier] || `Tier ${d.tier}`}** · #${d.rank} by revenue · ${d.ind} · ${d.region} · Owner: ${d.owner}`,
    `Existing annual revenue: ${money(d.rev)} · Helios deal: ${d.deal ? money(d.deal) : 'None yet'}`,
    `### Why now\n${d.why}`, `### CRM evidence\n${list(d.ev)}`, `### Use case\n${d.use}`,
    `### Proof to lead with (Exhibit A)\n${list(d.proof)}`, `### Pilot scope\n${list(d.pilot)}`,
    `### Excluded-use checks\n${list(d.excl)}`, `### Watch out for\n${d.risk}`, `### Next step\n${d.next}`,
  ].join('\n\n')).join('\n\n---\n\n') + '\n';
}

async function trackerCsv() {
  const { stakeholders } = await loadStakeholders();
  const rows = [['Section', 'Owner', 'Team', 'Item', 'Due / needed by', 'Urgency / risk', 'Detail']];
  for (const s of stakeholders) for (const t of s.tasks) rows.push(['Milestone', s.name, s.team, t.label, t.due, s.urgency, t.detail]);
  for (const s of stakeholders) if (s.pushback) rows.push(['Risk', s.name, s.team, s.pushback, s.neededBy, s.risk, `Resolution: ${s.resolution}`]);
  for (const s of stakeholders) for (const d of s.decisions) rows.push(['Decision', s.name, s.team, d, s.deadline, s.urgency, '']);
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const item = bySlug(q.get('slug') || '');
  const format = q.get('format') || '';
  if (!item) return new Response('Unknown document', { status: 404 });
  try {
    if (item.kind === 'cards' && format === 'md') return file(cardsMarkdown(), 'text/markdown; charset=utf-8', 'helios-ae-account-cards.md');
    if (item.kind === 'tracker' && format === 'csv') return file(await trackerCsv(), 'text/csv; charset=utf-8', 'helios-launch-tracker.csv');
    if (item.kind === 'gdoc' && (format === 'docx' || format === 'pdf')) {
      const { body, type } = await fetchDocDownload(item.docId, format);
      return file(body, type, `helios-${item.slug}.${format}`);
    }
    return new Response('Unsupported format', { status: 400 });
  } catch (err) {
    return new Response(`Download unavailable: ${err?.message || err}`, { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}
