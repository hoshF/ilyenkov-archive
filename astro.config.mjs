// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFile } from 'node:fs/promises';

// https://astro.build/config
export default defineConfig({
  site: 'https://ilyenkov.cn/',
  trailingSlash: 'never',
  vite: {
    plugins: [{
      name: 'serve-built-search-in-development',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const path = req.url?.split('?')[0];
          if (!path?.startsWith('/pagefind/')) return next();
          if (!/^\/pagefind\/[a-zA-Z0-9_./-]+$/.test(path) || path.split('/').includes('..')) {
            res.statusCode = 400; res.end(); return;
          }
          try {
            const content = await readFile(new URL(`./dist${path}`, import.meta.url));
            res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.json') ? 'application/json' : path.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
            res.end(content);
          } catch {
            res.statusCode = 404; res.end('Build the search index with npm run build');
          }
        });
      },
    }],
  },
  integrations: [sitemap({ filter: (url) => new URL(url).pathname !== '/404' })],
});
