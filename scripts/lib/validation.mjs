import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const datePattern = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;

export function fail(message) {
  throw new Error(message);
}

export function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

export function requiredString(record, key, label) {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) fail(`${label}: missing ${key}`);
  if (/\r|\n/.test(value)) fail(`${label}: ${key} must be one line`);
  return value.trim();
}

export function optionalString(record, key, label) {
  const value = record[key];
  if (value === undefined || value === null) return null;
  return requiredString(record, key, label);
}

export function requiredStringArray(record, key, label) {
  if (!Array.isArray(record[key]) || record[key].length === 0) {
    fail(`${label}: ${key} must be a non-empty array`);
  }
  return record[key].map((value, index) => {
    if (typeof value !== 'string' || !value.trim()) {
      fail(`${label}: ${key}[${index}] must be a string`);
    }
    return value.trim();
  });
}

export function publicUrl(value, label) {
  const url = requiredString({ url: value }, 'url', label);
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.host) throw new Error();
  } catch {
    fail(`${label}: url must be public http(s)`);
  }
  return url;
}

export function resolveResearchPath(researchRoot, relative, label) {
  if (path.isAbsolute(relative) || relative.includes('\0')) fail(`${label} must be relative`);
  const resolved = path.resolve(researchRoot, relative);
  if (!resolved.startsWith(`${researchRoot}${path.sep}`)) fail(`${label} escapes Ilyenkov`);
  return resolved;
}

export function readResearchJson(researchRoot, relative, label) {
  const file = resolveResearchPath(researchRoot, relative, label);
  if (!existsSync(file)) fail(`missing ${label}`);
  try {
    return object(JSON.parse(readFileSync(file, 'utf8')), label);
  } catch (error) {
    if (error instanceof SyntaxError) fail(`${label} is not valid JSON`);
    throw error;
  }
}

export function sourceIdsIn(value, ids = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => sourceIdsIn(item, ids));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if ((key === 'sources' || key === 'event_sources') && Array.isArray(item)) {
        item.forEach((id) => { if (typeof id === 'string') ids.add(id); });
      } else {
        sourceIdsIn(item, ids);
      }
    }
  }
  return ids;
}

export function formatPeriod(record, label) {
  const start = optionalString(record, 'period_start', label) ?? optionalString(record, 'date', label);
  const end = optionalString(record, 'period_end', label) ?? optionalString(record, 'date', label);
  if (!start || !datePattern.test(start) || !end || !datePattern.test(end)) {
    fail(`${label}: invalid historical period`);
  }
  return { start, end };
}
