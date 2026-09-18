import { MATERIALS } from '../lib/materials.js';
import { docUrl, sheetUrl } from '../lib/config.js';
import { json } from '../lib/respond.js';

export async function GET() {
  return json({ materials: MATERIALS.map(({ docId, sheetId, ...m }) => ({ ...m, docUrl: docId ? docUrl(docId) : sheetId ? sheetUrl(sheetId) : null })) }, { live: false });
}
