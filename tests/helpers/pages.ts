import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** 页面与组件源码的统一入口，免得每条断言各写一遍 readFileSync + path.join。 */

const pagesRoot = path.join(process.cwd(), 'src/pages');
const componentsRoot = path.join(process.cwd(), 'src/components');

/** route 是 src/pages 下的相对路径，例如 'books/index.astro'。 */
export function pageSource(route: string): string {
  return readFileSync(path.join(pagesRoot, route), 'utf8');
}

export function componentSource(name: string): string {
  return readFileSync(path.join(componentsRoot, `${name}.astro`), 'utf8');
}

export function pageFileExists(route: string): boolean {
  return existsSync(path.join(pagesRoot, route));
}

/** 站内链接是否有对应页面：/books → books/index.astro 或 books.astro。 */
export function routeExists(href: string): boolean {
  const relative = href === '/' ? 'index' : href.replace(/^\//, '');
  return pageFileExists(`${relative}.astro`) || pageFileExists(path.join(relative, 'index.astro'));
}
