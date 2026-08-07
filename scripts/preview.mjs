import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const outputDirectory = resolve(process.cwd(), 'out');
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '127.0.0.1';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function existingFile(pathname) {
  const decodedPath = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidate = resolve(outputDirectory, decodedPath);

  if (candidate !== outputDirectory && !candidate.startsWith(`${outputDirectory}${sep}`)) {
    return null;
  }

  const possibilities = [candidate];
  if (pathname.endsWith('/')) possibilities.push(resolve(candidate, 'index.html'));
  else possibilities.push(`${candidate}.html`, resolve(candidate, 'index.html'));

  for (const filePath of possibilities) {
    try {
      await access(filePath);
      if ((await stat(filePath)).isFile()) return filePath;
    } catch {
      // Try the next static-export path form.
    }
  }

  return null;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const filePath = (await existingFile(url.pathname)) ?? resolve(outputDirectory, '404.html');
    const statusCode = filePath.endsWith('404.html') ? 404 : 200;

    response.writeHead(statusCode, {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    });

    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
  }
});

server.listen(port, host, () => {
  console.log(`EduNets preview: http://${host}:${port}`);
});
