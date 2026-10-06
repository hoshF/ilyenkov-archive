import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readEditorialJson, site } from '../src/lib/editorial';
import { pageFileExists, routeExists } from './helpers/pages';

const builtPage = (route: string): string => readFileSync(
  path.join(process.cwd(), 'dist', route.replace(/^\//, ''), 'index.html'),
  'utf8',
);

const pageMain = (html: string): string => html.match(/<main>([\s\S]*?)<\/main>/)![1];

function links(html: string): { href: string; label: string }[] {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)]
    .map(([, href, label]) => ({ href, label }));
}

describe('following and contacting the group', () => {
  it('keeps the group email in the existing site configuration as its single fact source', () => {
    const source = readEditorialJson('site.json') as { contact: { email: string } };
    expect(site.contact).toEqual(source.contact);
    expect(site.contact.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

    // 单一事实源是编辑配置；页面和数据适配器不能另存一份邮箱文字。
    const emailSources: string[] = [];
    for (const directory of ['editorial', 'src']) {
      const root = path.join(process.cwd(), directory);
      for (const file of readdirSync(root, { recursive: true, withFileTypes: true })) {
        if (!file.isFile() || !/\.(?:json|astro|ts|mjs)$/.test(file.name)) continue;
        const filename = path.join(file.parentPath, file.name);
        if (readFileSync(filename, 'utf8').includes(site.contact.email)) {
          emailSources.push(path.relative(process.cwd(), filename));
        }
      }
    }
    expect(emailSources).toEqual([path.join('editorial', 'site.json')]);
  });

  it('builds a static contact page with updates, contact and participation information', () => {
    expect(pageFileExists('contact/index.astro')).toBe(true);
    expect(routeExists('/contact/')).toBe(true);
    const html = builtPage('/contact/');
    const main = pageMain(html);
    expect([...main.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(main).toContain('关注与联系</h1>');
    expect([...main.matchAll(/<h2\b[^>]*>([^<]*)<\/h2>/g)].map(([, heading]) => heading))
      .toEqual(['获取更新', '联系', '参与']);
    expect(links(main).some(({ href }) => href === '/updates/')).toBe(true);
    expect(links(main)).toContainEqual({ href: `mailto:${site.contact.email}`, label: site.contact.email });

    // 联系范围与长期参与意愿通过文字表达，不引入站内收集或订阅功能。
    for (const topic of ['译文', '资料', '研究', '工作记录', '校订', '网站问题']) {
      expect(main, topic).toContain(topic);
    }
    for (const phrase of ['苏联哲学', '介绍', '兴趣', '正在进行的工作']) {
      expect(main, phrase).toContain(phrase);
    }
    expect(html).not.toMatch(/<script\b|<form\b|<input\b|<astro-island\b/);
    expect(main).not.toMatch(/招募成员|加入我们|成为志愿者/);
  });

  it('gives the homepage a lightweight contact entrance after public updates', () => {
    const main = pageMain(builtPage('/'));
    const section = main.match(/<section class="home-follow"[\s\S]*?<\/section>/)![0];
    expect(main.indexOf('home-follow')).toBeGreaterThan(main.indexOf('home-updates'));
    expect(section).toContain('持续关注</h2>');
    expect(links(section)).toEqual([{ href: '/contact/', label: '关注与联系' }]);
    expect(section).not.toMatch(/<script\b|<form\b|<input\b|<button\b|<astro-island\b/);
  });

  it('replaces unpublished contact placeholders with the contact page entrance', () => {
    for (const route of ['/group/', '/about/']) {
      const main = pageMain(builtPage(route));
      expect(main, route).not.toMatch(/参与方式[\s\S]{0,12}尚未发布|联系方式尚未发布/);
      expect(links(main), route).toContainEqual({ href: '/contact/', label: '关注与联系' });
      // 身份、工作与权利页只提供入口，联系信息由 contact 页说明。
      expect(main, route).not.toContain(site.contact.email);
      expect(main, route).not.toContain('mailto:');
    }
  });

  it('adds only the actual updates and contact needs to the existing footer', () => {
    const expected = [
      { label: '项目与权利', href: '/about' },
      { label: '小组', href: '/group' },
      { label: '近期动态', href: '/updates/' },
      { label: '关注与联系', href: '/contact/' },
    ];
    expect(site.footer).toEqual(expected);
    for (const route of ['/', '/contact/', '/group/', '/updates/']) {
      const footer = builtPage(route).match(/<footer class="site-footer">([\s\S]*?)<\/footer>/)![1];
      // 页脚站名字标保留；其余文字入口仍全部来自站点配置。
      expect(links(footer)).toEqual([{ href: '/', label: site.name }, ...site.footer]);
    }
    for (const item of site.footer) {
      expect(routeExists(item.href), item.href).toBe(true);
      expect(() => builtPage(item.href), item.href).not.toThrow();
    }
  });

  it('keeps the five content sections as the only primary navigation destinations', () => {
    expect(site.navigation.map(({ href }) => href))
      .toEqual(['/ilyenkov', '/archive', '/research', '/group', '/books']);
    for (const route of ['/', '/contact/', '/group/', '/updates/']) {
      const html = builtPage(route);
      const nav = html.match(/<nav\b[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
      expect(links(nav), route).toEqual(site.navigation);
    }
  });
});
