import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** 页面与组件源码的统一读取入口。 */

const pagesRoot = path.join(process.cwd(), 'src/pages');
const componentsRoot = path.join(process.cwd(), 'src/components');
const layoutsRoot = path.join(process.cwd(), 'src/layouts');

/** route 是 src/pages 下的相对路径，例如 'books/index.astro'。 */
export function pageSource(route: string): string {
  return readFileSync(path.join(pagesRoot, route), 'utf8');
}

export function componentSource(name: string): string {
  return readFileSync(path.join(componentsRoot, `${name}.astro`), 'utf8');
}

export function layoutSource(name: string): string {
  return readFileSync(path.join(layoutsRoot, `${name}.astro`), 'utf8');
}

export function pageFileExists(route: string): boolean {
  return existsSync(path.join(pagesRoot, route));
}

/** 站内链接是否有对应页面或静态 endpoint。 */
export function routeExists(href: string): boolean {
  const relative = href === '/' ? 'index' : href.replace(/^\//, '').replace(/\/$/, '');
  return ['astro', 'ts', 'js'].some((extension) => (
    pageFileExists(`${relative}.${extension}`)
      || pageFileExists(path.join(relative, `index.${extension}`))
  ));
}

/** 目录页面与 RSS 等静态文件在 dist 中的实际位置。 */
export function builtRoutePath(href: string): string {
  const relative = href.replace(/^\//, '').replace(/\/$/, '');
  return path.join(process.cwd(), 'dist', path.extname(relative) ? relative : path.join(relative, 'index.html'));
}
