import { MATERIALS } from '../lib/materials.js';
import { docUrl } from '../lib/config.js';
import { json } from '../lib/respond.js';

export async function GET() {
  return json({ materials: MATERIALS.map(({ docId, ...m }) => ({ ...m, docUrl: docId ? docUrl(docId) : null })) }, { live: false });
}
