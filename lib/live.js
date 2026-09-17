// Live loaders with snapshot fallback: the site always has data to draw, even if Google is unreachable.
import { ACCOUNTS_SHEET_ID, STAKEHOLDER_SHEET_ID, sheetUrl } from './config.js';
import { fetchSheetXlsx } from './google.js';
import { readXlsx } from './xlsx.js';
import { parseAccounts } from './accounts.js';
import { parseStakeholders } from './stakeholders.js';
import accountsSnapshot from '../data/snapshot/accounts.js';
import stakeholdersSnapshot from '../data/snapshot/stakeholders.js';

async function load(id, parse, snapshot) {
  const base = { sheetUrl: sheetUrl(id), fetchedAt: new Date().toISOString() };
  try {
    const data = parse(readXlsx(await fetchSheetXlsx(id)));
    return { source: 'live', ...base, ...data };
  } catch (err) {
    const { capturedAt, ...data } = snapshot;
    return { source: 'snapshot', snapshotDate: capturedAt, error: String(err?.message || err), ...base, ...data };
  }
}
export const loadAccounts = () => load(ACCOUNTS_SHEET_ID, parseAccounts, accountsSnapshot);
export const loadStakeholders = () => load(STAKEHOLDER_SHEET_ID, parseStakeholders, stakeholdersSnapshot);
