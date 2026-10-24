import { createServer } from 'node:http';
import { access, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

/** Serve an existing build only; never sync or build publication inputs. */
export async function startStaticSite(directory = path.resolve('dist')) {
  let root: string;
  try {
    root = await realpath(directory);
    for (const file of ['glossary/index.html', 'archive/index.html', 'pagefind/pagefind.js']) {
      await access(path.join(root, file));
    }
  } catch {
    throw new Error('Browser tests require an existing complete dist/. Run npm run build with authorized publication inputs, then rerun npm run test:browser. No build was started.');
  }
  const withinRoot = (file: string) => file === root || file.startsWith(`${root}${path.sep}`);
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      let file = path.resolve(root, `.${pathname}`);
      if (!withinRoot(file)) { response.writeHead(403).end(); return; }
      if ((await stat(file)).isDirectory()) {
        if (!pathname.endsWith('/')) {
          response.writeHead(308, { Location: `${url.pathname}/${url.search}` }).end();
          return;
        }
        file = path.join(file, 'index.html');
      }
      file = await realpath(file);
      if (!withinRoot(file)) { response.writeHead(403).end(); return; }
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(file)] ?? 'application/octet-stream',
        'Content-Length': body.length,
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Static browser-test server did not receive a TCP port');
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  };
}
