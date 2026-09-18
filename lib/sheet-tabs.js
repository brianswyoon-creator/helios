// Turn every visible tab of a workbook into a plain table: header row + rows, with empty edge rows/columns trimmed.
const str = (v) => (v == null ? '' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)) : String(v).replace(/\r/g, '').trim());

export function sheetTabs(workbook) {
  const tabs = [];
  for (const sheet of workbook.sheets) {
    if (sheet.hidden) continue;
    const grid = sheet.rows.map((r) => (r || []).map(str));
    const used = grid.map((r) => r.map((c) => c !== ''));
    const cols = Math.max(0, ...grid.map((r) => r.length));
    let first = cols, last = -1;
    used.forEach((r) => r.forEach((on, i) => { if (on) { first = Math.min(first, i); last = Math.max(last, i); } }));
    if (last < 0) continue;
    const rows = grid.map((r) => Array.from({ length: last - first + 1 }, (_, i) => r[first + i] ?? '')).filter((r) => r.some((c) => c !== ''));
    // The header is the first row with at least two filled cells; anything above it is a title.
    const hi = rows.findIndex((r) => r.filter((c) => c !== '').length >= 2);
    if (hi < 0) continue;
    const title = rows.slice(0, hi).map((r) => r.filter(Boolean).join(' ')).filter(Boolean).join(' · ');
    tabs.push({ name: sheet.name, title, header: rows[hi], rows: rows.slice(hi + 1) });
  }
  return tabs;
}
