// Serves the static export like the production nginx vhost (docs/ADMIN_DEPLOYMENT_PLAN.md):
//   try_files $uri $uri.html $uri/ =404, long-lived cache for /_next/static, and — when
//   CLEARWOOD_API_ORIGIN is set — /api, /health and /ready proxied to the API (same-origin).
//
//   npm run build && npm run preview              (PORT=7183 by default)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');
const PORT = Number(process.env.PORT ?? 7183);
const API_ORIGIN = process.env.CLEARWOOD_API_ORIGIN ?? '';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

if (!fs.existsSync(ROOT)) {
  console.error('No out/ directory: run `npm run build` first.');
  process.exit(1);
}

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\/+$/, '') || '/';
  const candidates =
    clean === '/' ? ['/index.html'] : [clean, `${clean}.html`, `${clean}/index.html`];
  for (const candidate of candidates) {
    const full = path.join(ROOT, candidate);
    if (!full.startsWith(ROOT)) return null;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

function proxy(req, res) {
  const target = new URL(req.url, API_ORIGIN);
  const upstream = http.request(
    target,
    { method: req.method, headers: { ...req.headers, host: target.host } },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/html' });
    res.end('<h1>502 Bad Gateway</h1>');
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const url = req.url ?? '/';
  if (/^\/(api\/|health$|ready$)/.test(url.split('?')[0])) {
    if (API_ORIGIN) return proxy(req, res);
    res.writeHead(502, { 'Content-Type': 'text/html' });
    return res.end('<h1>502 Bad Gateway</h1><p>Set CLEARWOOD_API_ORIGIN to proxy the API.</p>');
  }
  const file = resolveFile(url);
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
  };
  if (!file) {
    res.writeHead(404, { ...headers, 'Content-Type': TYPES['.html'] });
    return fs.createReadStream(path.join(ROOT, '404.html')).pipe(res);
  }
  const immutable = url.startsWith('/_next/static/');
  res.writeHead(200, {
    ...headers,
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(
    `Static admin on http://localhost:${PORT}${API_ORIGIN ? ` (API proxied to ${API_ORIGIN})` : ''}`,
  );
});
