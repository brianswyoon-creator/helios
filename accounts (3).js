// Normalise the "TargetAccounts" tab into a clean list of account records.
// Columns are located by header text, so re-ordering or adding columns in the sheet is safe.
const FIELDS = {
  name: /^account name$/i,
  status: /^account status/i,
  next: /^next steps/i,
  oppName: /^opportunity name$/i,
  oppNotes: /^opportunity notes$/i,
  acctNotes: /^account notes$/i,
  owner: /^account owner$/i,
  industry: /^industry$/i,
  subIndustry: /^sub-?industry$/i,
  region: /^region$/i,
  revenueK: /^annual revenue/i,
  oppK: /^opportunity size/i,
  dealRev: /^deal \/ revenue$/i,
};
const REQUIRED = ['name', 'status', 'next', 'industry', 'region', 'revenueK', 'oppK'];

const str = (v) => (v == null ? '' : String(v).trim());
const num = (v) => {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function locate(sheet) {
  for (let r = 0; r < Math.min(sheet.rows.length, 15); r++) {
    const row = sheet.rows[r] || [];
    const cols = {};
    row.forEach((cell, i) => {
      const text = str(cell);
      for (const [key, re] of Object.entries(FIELDS)) if (cols[key] == null && re.test(text)) cols[key] = i;
    });
    const hasRank = row.some((c) => /^rank$/i.test(str(c)));
    if (!hasRank && REQUIRED.every((k) => cols[k] != null)) return { headerRow: r, cols };
  }
  return null;
}

export function parseAccounts(workbook) {
  // Prefer the tab named TargetAccounts; otherwise any tab with the right header row.
  const ordered = [...workbook.sheets].sort((a, b) => (b.name === 'TargetAccounts') - (a.name === 'TargetAccounts'));
  for (const sheet of ordered) {
    const found = locate(sheet);
    if (!found) continue;
    const { headerRow, cols } = found;
    const accounts = [];
    for (let r = headerRow + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r] || [];
      const name = str(row[cols.name]);
      if (!name) continue;
      const dealRev = cols.dealRev == null ? '' : row[cols.dealRev];
      accounts.push({
        name,
        status: str(row[cols.status]),
        next: str(row[cols.next]),
        oppName: str(row[cols.oppName]),
        oppNotes: str(row[cols.oppNotes]),
        acctNotes: str(row[cols.acctNotes]),
        owner: str(row[cols.owner]),
        industry: str(row[cols.industry]),
        subIndustry: str(row[cols.subIndustry]),
        region: str(row[cols.region]),
        revenueK: num(row[cols.revenueK]),
        oppK: num(row[cols.oppK]),
        dealRev: typeof dealRev === 'number' ? `${dealRev.toFixed(2)}x` : str(dealRev),
      });
    }
    if (accounts.length) return { tab: sheet.name, accounts };
  }
  throw new Error('Could not find the TargetAccounts tab (needs "Account name" and "Account Status for Helios GA" columns).');
}
