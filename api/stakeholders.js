import { loadStakeholders } from '../lib/live.js';
import { json, isFresh } from '../lib/respond.js';

export async function GET(request) {
  const data = await loadStakeholders();
  return json(data, { live: data.source === 'live', fresh: isFresh(request) });
}
