import { checkPassword, sessionCookie, safeNext } from '../lib/auth.js';

export async function POST(request) {
  const form = new URLSearchParams(await request.text());
  const next = safeNext(form.get('next'));
  const ok = await checkPassword(form.get('password'));
  // Small fixed delay on failure slows down guessing.
  if (!ok) await new Promise((r) => setTimeout(r, 600));
  const secure = new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  const headers = { 'cache-control': 'no-store', location: ok ? next : `/login?error=1&next=${encodeURIComponent(next)}` };
  if (ok) headers['set-cookie'] = await sessionCookie(secure);
  return new Response(null, { status: 303, headers });
}
