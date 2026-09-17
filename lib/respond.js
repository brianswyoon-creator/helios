import { CACHE_SECONDS } from './config.js';

export function json(data, { status = 200, live = true, fresh = false } = {}) {
  // Live data may be reused by the CDN for a few seconds; snapshots and forced refreshes are never cached.
  const cache = live && !fresh ? `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}` : 'no-store';
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } });
}
export const isFresh = (request) => new URL(request.url).searchParams.has('fresh');
