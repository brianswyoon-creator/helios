// Site-wide password gate. Works in both the Edge (middleware) and Node (API) runtimes.
// The password is never stored in plain text here: only its SHA-256 hash is.
// To change it, set the SITE_PASSWORD environment variable in Vercel (it overrides the default).
const DEFAULT_PASSWORD_SHA256 = 'c7575274a20d035b5a72baa824b2b6f8fcc29ab184bd322947dd27b6168ab1aa';
export const COOKIE = 'helios_auth';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const PUBLIC_PATHS = new Set(['/login', '/login.html', '/api/login', '/favicon.svg', '/robots.txt']);

async function sha256(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const env = (k) => (typeof process !== 'undefined' && process.env ? process.env[k] : undefined);
const gateDisabled = () => env('AUTH_DISABLED') === '1';
const passwordHash = async () => (env('SITE_PASSWORD') ? sha256(env('SITE_PASSWORD')) : DEFAULT_PASSWORD_SHA256);
// The session token is derived from the password, so changing the password signs everyone out.
const sessionToken = async () => sha256(`helios-session:${await passwordHash()}:${env('SESSION_SECRET') || ''}`);

function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export async function checkPassword(password) {
  return equal(await sha256(String(password ?? '')), await passwordHash());
}
export async function isAuthed(cookieHeader) {
  if (gateDisabled()) return true;
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`).exec(cookieHeader || '');
  return !!m && equal(m[1], await sessionToken());
}
export async function sessionCookie(secure = true) {
  return `${COOKIE}=${await sessionToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

/** Only allow redirects back into this site. */
export function safeNext(next) {
  const n = String(next || '');
  return /^\/(?![/\\])[^\s]*$/.test(n) && !n.startsWith('/login') ? n : '/pipeline';
}

/** Returns null when the request may continue, otherwise the Response to send instead. */
export async function gate(request) {
  const url = new URL(request.url);
  if (PUBLIC_PATHS.has(url.pathname)) return null;
  if (await isAuthed(request.headers.get('cookie'))) return null;
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Sign in required' }), { status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
  const isPage = !/\.[a-z0-9]+$/i.test(url.pathname) || url.pathname.endsWith('.html');
  const next = isPage ? url.pathname + url.search : '/pipeline';
  return new Response(null, { status: 307, headers: { location: `/login?next=${encodeURIComponent(next)}`, 'cache-control': 'no-store' } });
}
