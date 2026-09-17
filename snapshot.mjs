// Refresh the built-in fallback snapshots from the live Google Sheets:  npm run snapshot
// (The site only uses these files when Google cannot be reached.)
import { writeFile } from 'node:fs/promises';
import { ACCOUNTS_SHEET_ID, STAKEHOLDER_SHEET_ID } from '../lib/config.js';
import { fetchSheetXlsx } from '../lib/google.js';
import { readXlsx } from '../lib/xlsx.js';
import { parseAccounts } from '../lib/accounts.js';
import { parseStakeholders } from '../lib/stakeholders.js';

const today = new Date().toISOString().slice(0, 10);
const jobs = [
  ['data/snapshot/accounts.js', ACCOUNTS_SHEET_ID, parseAccounts, 'Snapshot of the TargetAccounts tab'],
  ['data/snapshot/stakeholders.js', STAKEHOLDER_SHEET_ID, parseStakeholders, 'Snapshot of the Helios Stakeholder Plan sheet'],
];
for (const [file, id, parse, note] of jobs) {
  const data = parse(readXlsx(await fetchSheetXlsx(id)));
  await writeFile(new URL(`../${file}`, import.meta.url), `// ${note}, used only when Google cannot be reached.\n// Refresh with: npm run snapshot\nexport default ${JSON.stringify({ capturedAt: today, ...data })};\n`);
  console.log(`updated ${file}`);
}
