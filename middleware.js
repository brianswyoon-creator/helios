// Vercel Routing Middleware: every page, asset and API call passes the password gate first.
import { next } from '@vercel/functions';
import { gate } from './lib/auth.js';

export default async function middleware(request) {
  return (await gate(request)) ?? next();
}
