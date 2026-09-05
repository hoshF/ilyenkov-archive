import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** 同步器的公共外壳：比较、写盘、--check 只报告不改写、统一退出码。 */

/**
 * 写一个生成文件；内容没变就什么都不做。checkOnly 时只回报是否过期。
 * 返回 true 表示这个文件与计划输出不一致。
 */
export function writeGenerated(target, content, { checkOnly = false } = {}) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  if (current === content) return false;
  if (!checkOnly) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  return true;
}

/**
 * 跑一个同步器：解析 --check，为错误加上统一前缀。
 * 退出码 1 = 生成结果过期（只在 --check 下出现），2 = 同步失败。
 */
export function runSync(name, sync) {
  try {
    sync({ checkOnly: process.argv.includes('--check') });
  } catch (error) {
    console.error(`${name} sync error: ${error.message}`);
    process.exitCode = 2;
  }
}
