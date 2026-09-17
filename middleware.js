// Vercel Routing Middleware: every page, asset and API call passes the password gate first.
// Deliberately dependency-free. "Continue to the requested page" is signalled to Vercel with the
// `x-middleware-next` response header (this is exactly what `next()` from @vercel/functions returns).
import { gate } from './lib/auth.js';

const proceed = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

export default async function middleware(request) {
  try {
    return (await gate(request)) ?? proceed();
  } catch (err) {
    // Fail closed, but say why, so a misconfiguration is diagnosable from the browser.
    return new Response(`Password gate error: ${err?.message || err}`, { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
}
