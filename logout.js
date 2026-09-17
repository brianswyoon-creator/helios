import { clearCookie } from '../lib/auth.js';

export async function GET() {
  return new Response(null, { status: 303, headers: { location: '/login', 'set-cookie': clearCookie(), 'cache-control': 'no-store' } });
}
