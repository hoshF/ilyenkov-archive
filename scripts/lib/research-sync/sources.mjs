import {
  fail,
  object,
  optionalString,
  publicUrl,
  requiredString,
  requiredStringArray,
  uniqueMatch,
} from '../validation.mjs';

function selectedSources(sourceData, sourceIds, label) {
  if (!Array.isArray(sourceData.records)) fail(`${label}: records must be an array`);
  const records = sourceData.records.map((raw) => {
    const source = object(raw, `${label} record`);
    return { id: requiredString(source, 'source_id', label), source };
  });
  return sourceIds.map((id) => uniqueMatch(records, (record) => record.id === id,
    `${label} source_id ${id}`).source);
}

export function sourceRecords(sourceData, sourceIds, label) {
  return selectedSources(sourceData, sourceIds, label).map((source) => {
    const sourceId = requiredString(source, 'source_id', label);
    const url = Array.isArray(source.urls)
      ? source.urls[0]
      : [source.urls?.current, source.urls?.original, source.urls?.archive, source.url]
        // Only an absent URL permits fallback; a selected invalid URL must fail validation.
        .find((value) => value !== undefined && value !== null
          && !(typeof value === 'string' && !value.trim()));
    if (typeof url !== 'string') fail(`${label}: ${sourceId} has no public URL`);
    return {
      title: requiredString(source, 'title', `${label} ${sourceId}`),
      creator: optionalString(source, 'creator', `${label} ${sourceId}`)
        ?? optionalString(source, 'author', `${label} ${sourceId}`)
        ?? optionalString(source, 'responsible_entity', `${label} ${sourceId}`),
      url: publicUrl(url, `${label} ${sourceId}`),
    };
  });
}

export function readingSources(sourceData, sourceIds, label, requiredCapabilities = []) {
  const selected = selectedSources(sourceData, sourceIds, label);
  const supports = (source, capability) => (
    Array.isArray(source.supports) && source.supports.includes(capability)
  );
  if (!selected.some((source) => (
    ['conference_title', 'themes', 'program'].some((capability) => supports(source, capability))
  ))) {
    fail(`${label}: selected sources do not support the conference title`);
  }
  if (!selected.some((source) => supports(source, 'conference_dates'))) {
    fail(`${label}: selected sources do not support the conference dates`);
  }
  for (const capability of requiredCapabilities) {
    if (!selected.some((source) => supports(source, capability))) {
      fail(`${label}: selected sources do not support ${capability}`);
    }
  }
  return sourceRecords(sourceData, sourceIds, label);
}

export function ifiSources(sourceData, sourceIds, label) {
  const selected = selectedSources(sourceData, sourceIds, label);
  const supports = (source, capability) => (
    Array.isArray(source.supports) && source.supports.includes(capability)
  );
  for (const capability of ['activity_title', 'activity_dates', 'activity_location']) {
    if (!selected.some((source) => supports(source, capability))) {
      fail(`${label}: selected sources do not support the activity ${capability.slice('activity_'.length)}`);
    }
  }
  return sourceRecords(sourceData, sourceIds, label);
}

export function biographySources(sourceData, sourceIds, label) {
  for (const source of selectedSources(sourceData, sourceIds, label)) {
    const sourceId = requiredString(source, 'source_id', label);
    const supports = requiredStringArray(source, 'supports', `${label} ${sourceId}`);
    for (const capability of ['biographical_fact', 'historical_date']) {
      if (!supports.includes(capability)) fail(`${label}: ${sourceId} does not support ${capability}`);
    }
  }
  return sourceRecords(sourceData, sourceIds, label);
}

export function workSources(sourceData, sourceUrls, workId, label) {
  if (!Array.isArray(sourceData.sources)) fail(`${label}: sources must be an array`);
  const sources = sourceData.sources.map((raw) => {
    const source = object(raw, `${label} source`);
    return { url: publicUrl(source.url, label), source };
  });

  return sourceUrls.map((url) => {
    const { source } = uniqueMatch(sources, (record) => record.url === url, `${label} source URL ${url}`);
    const linkedWorkIds = Array.isArray(source.work_id) ? source.work_id : [source.work_id];
    if (!linkedWorkIds.includes(workId)) fail(`${label}: selected source is not linked to the work`);
    const kind = requiredString(source, 'kind', `${label} ${url}`);
    if (!['text', 'record'].includes(kind)) fail(`${label}: selected source must be text or record`);
    return {
      label: kind === 'text' ? '俄文文本' : '书目来源',
      title: requiredString(source, 'title', `${label} ${url}`),
      url,
    };
  });
}
