// Returns one Launch Materials document, rendered from its live Google Doc.
import { bySlug } from '../lib/materials.js';
import { docUrl, sheetUrl } from '../lib/config.js';
import { fetchDocHtml, fetchSheetXlsx } from '../lib/google.js';
import { readXlsx } from '../lib/xlsx.js';
import { sheetTabs } from '../lib/sheet-tabs.js';
import { sanitizeDoc } from '../lib/sanitize.js';
import { json, isFresh } from '../lib/respond.js';
import cards from '../data/ae-cards.js';

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('slug') || '';
  const item = bySlug(slug);
  if (!item) return json({ error: 'Unknown document' }, { status: 404, live: false });
  const base = { slug: item.slug, title: item.title, kind: item.kind, blurb: item.blurb, note: item.note, pdf: item.pdf, fetchedAt: new Date().toISOString() };
  if (item.kind === 'cards') return json({ ...base, source: 'site', cards }, { live: false });
  if (item.kind === 'gsheet') {
    try {
      const tabs = sheetTabs(readXlsx(await fetchSheetXlsx(item.sheetId)));
      return json({ ...base, source: 'live', docUrl: sheetUrl(item.sheetId), tabs }, { fresh: isFresh(request) });
    } catch (err) {
      return json({ ...base, source: 'unavailable', docUrl: sheetUrl(item.sheetId), error: String(err?.message || err) }, { live: false });
    }
  }
  try {
    const doc = sanitizeDoc(await fetchDocHtml(item.docId));
    return json({ ...base, source: 'live', docUrl: docUrl(item.docId), html: doc.html, headings: doc.headings, words: doc.words }, { fresh: isFresh(request) });
  } catch (err) {
    return json({ ...base, source: 'unavailable', docUrl: docUrl(item.docId), error: String(err?.message || err) }, { live: false });
  }
}
