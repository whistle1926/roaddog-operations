// Minimal static file server for local development. No dependencies.
// Usage: node server.js  (PORT env var optional, defaults to 4173)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = path.normalize(path.join(ROOT, pathname));
    if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden');
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) return send(res, 404, 'Not found');
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
  } catch (e) {
    send(res, 500, 'Server error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`RoadDog Operations running at http://127.0.0.1:${PORT}`);
});
