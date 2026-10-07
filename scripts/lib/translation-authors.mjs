import { fail, object, readResearchJson, requiredString } from './validation.mjs';

const registryRelative = 'people/persons.json';

/** 只索引 canonical identity；人物的其他研究事实不进入译文生成模型。 */
export function canonicalPersonRegistry(researchRoot) {
  const registry = readResearchJson(researchRoot, registryRelative, registryRelative);
  if (!Array.isArray(registry.records) || registry.records.length === 0) {
    fail(`${registryRelative}: records must be a non-empty array`);
  }
  const byId = new Map();
  for (const [index, rawRecord] of registry.records.entries()) {
    const label = `${registryRelative} records[${index}]`;
    const record = object(rawRecord, label);
    const personId = requiredString(record, 'person_id', label);
    if (byId.has(personId)) fail(`${registryRelative}: duplicate person_id ${personId}`);
    byId.set(personId, personId);
  }
  return byId;
}

/** 作者身份与显示署名来自同一显式数组，不从目录、taxonomy 或研究者选择推导。 */
export function translationAuthors(work, label, registry) {
  for (const unsupported of ['author', 'author_ids']) {
    if (Object.hasOwn(work, unsupported)) {
      fail(`${label}: ${unsupported} is not supported; use authors with person_id and name_zh`);
    }
  }
  if (!Array.isArray(work.authors) || work.authors.length === 0) {
    fail(`${label}: authors must be a non-empty array`);
  }
  const names = [];
  const ids = [];
  const seen = new Set();
  for (const [index, rawAuthor] of work.authors.entries()) {
    const authorLabel = `${label}: authors[${index}]`;
    const author = object(rawAuthor, authorLabel);
    const unknownKeys = Object.keys(author).filter((key) => !['person_id', 'name_zh'].includes(key));
    if (unknownKeys.length) fail(`${authorLabel}: unknown keys ${unknownKeys.join(', ')}`);
    const personId = requiredString(author, 'person_id', authorLabel);
    const name = requiredString(author, 'name_zh', authorLabel);
    if (seen.has(personId)) fail(`${label}: duplicate author person_id ${personId}`);
    if (!registry.has(personId)) fail(`${label}: unknown person_id ${personId}`);
    seen.add(personId);
    names.push(name);
    ids.push(personId);
  }
  return { names, ids };
}
