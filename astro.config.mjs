// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFile } from 'node:fs/promises';

// https://astro.build/config
export default defineConfig({
  site: 'https://ilyenkov.cn/',
  // Cloudflare Pages 对目录型产物强制 308 到带尾斜杠的地址；用 'always' 让内链、canonical
  // 与 sitemap 同 Pages 实际服务的 URL 一致，避免每次站内跳转都多一次重定向。
  trailingSlash: 'always',
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
