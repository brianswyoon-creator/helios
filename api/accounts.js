import { loadAccounts } from '../lib/live.js';
import { json, isFresh } from '../lib/respond.js';

export async function GET(request) {
  const data = await loadAccounts();
  return json(data, { live: data.source === 'live', fresh: isFresh(request) });
}
