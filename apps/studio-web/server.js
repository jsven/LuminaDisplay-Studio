const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const staticDir = path.join(__dirname, 'dist');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
};

function resolvePath(urlPath) {
  const cleanPath = decodeURIComponent((urlPath || '/').split('?')[0]);
  const target = cleanPath === '/' ? '/index.html' : cleanPath;
  const filePath = path.normalize(path.join(staticDir, target));

  if (!filePath.startsWith(staticDir)) {
    return null;
  }

  return filePath;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (readError, buffer) => {
    if (readError) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Failed to read file.');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Cache-Control': ext === '.json' ? 'no-store' : 'public, max-age=60',
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    });
    res.end(buffer);
  });
}

const server = http.createServer((req, res) => {
  if (!fs.existsSync(staticDir)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Build output not found. Run npm run build first.');
    return;
  }

  const filePath = resolvePath(req.url);

  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (!statError && stats.isFile()) {
      sendFile(res, filePath);
      return;
    }

    if (!statError && stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (indexError, indexStats) => {
        if (!indexError && indexStats.isFile()) {
          sendFile(res, indexPath);
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
      });
      return;
    }

    const fallbackPath = path.join(staticDir, 'index.html');
    const looksLikeAppRoute = !path.extname(filePath);

    if (looksLikeAppRoute) {
      sendFile(res, fallbackPath);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
});

function startServer(port = Number(process.env.PORT || 4173)) {
  return server.listen(port, () => {
    console.log(`Lumina studio preview is running at http://localhost:${port}`);
  });
}

if (require.main === module) {
  if (!fs.existsSync(staticDir)) {
    console.error('Build output not found. Run npm run build first.');
    process.exit(1);
  }
  startServer();
}

server.startServer = startServer;
module.exports = server;
