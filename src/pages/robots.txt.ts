import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('A production site URL is required');
  return new Response(`User-agent: *
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

Sitemap: ${new URL('/sitemap-index.xml', site).href}
`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
