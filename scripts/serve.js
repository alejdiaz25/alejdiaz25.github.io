#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
};

function createServer() {
  return http.createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const parts = pathname.replace(/\\/g, '/').split('/');
      if (parts.some(part => part.startsWith('.') || part === 'node_modules')) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      const filename = path.resolve(ROOT, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
      const relative = path.relative(ROOT, filename);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      const stat = await fs.promises.stat(filename);
      if (!stat.isFile()) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(filename).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      if (!res.headersSent) res.writeHead(error instanceof URIError ? 400 : 404);
      res.end(error instanceof URIError ? 'Bad request' : 'Not found');
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || process.argv[2] || 8000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid preview port');
  createServer().listen(port, '127.0.0.1', () => console.log(`Portfolio preview: http://127.0.0.1:${port}`));
}

module.exports = { createServer };
