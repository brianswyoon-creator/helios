// Zero-dependency local preview that mimics Vercel: static files from /public, clean URLs,
// the rewrites in vercel.json, /api/* functions and the password gate.
//   npm run dev            → http://localhost:3000
//   AUTH_DISABLED=1 npm run dev   (skip the password screen locally)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { gate } from '../lib/auth.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain' };
const toRegex = (source) => new RegExp(`^${source.replace(/:(\w+)/g, '[^/]+')}$`);
const rewrites = config.rewrites.map((r) => ({ re: toRegex(r.source), to: r.destination }));
const redirects = (config.redirects || []).map((r) => ({ re: toRegex(r.source), to: r.destination }));

async function send(res, response) {
  const headers = {};
  response.headers.forEach((v, k) => { headers[k] = v; });
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

const port = Number(process.env.PORT || 3000);
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    const blocked = await gate(request);
    if (blocked) return send(res, blocked);
    const redirect = redirects.find((r) => r.re.test(url.pathname));
    if (redirect) { res.writeHead(307, { location: redirect.to }); return res.end(); }
    if (url.pathname.startsWith('/api/')) {
      const mod = await import(pathToFileURL(path.join(root, `${url.pathname}.js`)).href);
      const handler = mod[req.method];
      if (!handler) { res.writeHead(405); return res.end('Method not allowed'); }
      return send(res, await handler(request));
    }
    let file = rewrites.find((r) => r.re.test(url.pathname))?.to || url.pathname;
    if (!path.extname(file)) file += '.html';
    const full = path.join(root, 'public', path.normalize(file));
    if (!full.startsWith(path.join(root, 'public'))) { res.writeHead(403); return res.end(); }
    const body = await readFile(full);
    res.writeHead(200, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' || err.code === 'ERR_MODULE_NOT_FOUND' ? 404 : 500, { 'content-type': 'text/plain' });
    res.end(err.code === 'ENOENT' ? 'Not found' : String(err.stack || err));
  }
}).listen(port, () => console.log(`Helios launch hub → http://localhost:${port}`));
