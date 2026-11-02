import type { GlossaryEntry } from './glossary-query';

export function glossaryTermNode(pageUrl: URL, entry: GlossaryEntry) {
  const url = new URL(entry.route, pageUrl).href;
  const alternateName = [...new Set([...entry.zh_alternatives, ...entry.forms])];
  return {
    '@type': 'DefinedTerm', '@id': url, url,
    name: entry.zh_preferred, termCode: entry.canonical,
    alternateName: alternateName.length ? alternateName : undefined,
    description: entry.notes.trim() || `${entry.zh_preferred}（${entry.canonical}）的译名与用法。`,
    inDefinedTermSet: { '@type': 'DefinedTermSet', name: '术语库', url: pageUrl.href },
  };
}
