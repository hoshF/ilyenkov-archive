import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { site } from '../lib/editorial';
import { getRssItems } from '../lib/rss';

export const prerender = true;

export const GET: APIRoute = async (context) => {
  if (!context.site) throw new Error('RSS requires Astro site configuration');
  return rss({
    title: site.name,
    description: `${site.name}的近期公开内容与工作动态。`,
    site: context.site,
    items: await getRssItems(context.site),
    trailingSlash: true,
  });
};
