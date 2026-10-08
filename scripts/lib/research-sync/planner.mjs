import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { publicationRelative } from '../paths.mjs';
import {
  datePattern,
  fail,
  formatPeriod,
  idPattern,
  object,
  optionalString,
  publicUrl,
  readResearchJson,
  resolveResearchPath,
  requiredString,
  requiredStringArray,
  sourceIdsIn,
  uniqueMatch,
} from '../validation.mjs';
import {
  biographySources,
  ifiSources,
  readingSources,
  sourceRecords,
  workSources,
} from './sources.mjs';

const websiteScope = 'website_public';
const ifiEventsRelative = 'research/friends/events.json';
const ifiActivityModes = new Set(['symposium', 'webinar', 'collective_reading', 'discussion']);
const ifiResourceKinds = new Set(['about', 'history', 'texts', 'symposiums', 'youtube', 'facebook']);
const ifiNetworkPublicationFields = new Set([
  'public_id', 'publication_scope', 'kind', 'record_path', 'record_id',
  'title_zh', 'summary_zh', 'resource_kinds', 'editorial_path',
]);
const readingsEventsRelative = 'research/readings/events.json';
const readingsSeriesRelative = 'research/readings/series.json';
const readingsResourceKinds = new Set(['archive', 'society', 'historical_archive']);
const readingsSeriesPublicationFields = new Set([
  'public_id', 'publication_scope', 'kind', 'record_path', 'record_id',
  'title_zh', 'summary_zh', 'resource_kinds', 'editorial_path',
]);
const personsRelative = 'people/persons.json';
const researcherResourceKinds = new Set(['personal', 'orcid', 'institution']);
const researcherPublicationFields = new Set([
  'public_id', 'publication_scope', 'kind', 'record_path', 'record_id',
  'title_zh', 'summary_zh', 'resource_kinds', 'editorial_path',
]);
const supportedKinds = new Set([
  'biography_event',
  'military_service',
  'hegel_congress',
  'works_catalog',
  'ilyenkov_readings',
  'ilyenkov_readings_series',
  'ifi_network',
  'ifi_symposium',
  'researcher_profile',
  'ilyenkov_profile',
  'research_site',
]);

function adaptResearchSite({ entry, label, publicId, recordData }) {
  const originalTitle = requiredString(entry, 'original_title', label);
  if (!requiredString(recordData, 'site', `${label} selected site`).includes(originalTitle)) {
    fail(`${label}: selected site does not identify the requested research site`);
  }
  if (!Array.isArray(recordData.source_pages)) {
    fail(`${label}: research site source pages are unavailable`);
  }
  const pages = recordData.source_pages.map((rawPage) => {
    const page = object(rawPage, `${label} source page`);
    return { url: publicUrl(requiredString(page, 'page', `${label} source page`), `${label} source page`), page };
  });
  if (!Array.isArray(recordData.files)) fail(`${label}: research site file index is unavailable`);
  const files = recordData.files.filter((rawFile) => (
    rawFile && typeof rawFile === 'object' && typeof rawFile.file === 'string'
  )).map((rawFile) => {
    const file = object(rawFile, `${label} source file`);
    return { path: requiredString(file, 'file', `${label} source file`), file };
  });
  const sectionTitles = object(recordData.sections, `${label} source sections`);
  const selectedSections = entry.sections;
  if (!Array.isArray(selectedSections) || selectedSections.length === 0) {
    fail(`${label}: sections must select at least one entry`);
  }
  const seenSectionIds = new Set();
  const sections = selectedSections.map((rawSection, sectionIndex) => {
    const sectionLabel = `${label} sections[${sectionIndex}]`;
    const selection = object(rawSection, sectionLabel);
    const sectionId = requiredString(selection, 'section_id', sectionLabel);
    if (seenSectionIds.has(sectionId)) fail(`${sectionLabel}: duplicate section_id`);
    seenSectionIds.add(sectionId);
    requiredString(sectionTitles, sectionId, `${sectionLabel} selected section`);
    const sourcePageUrl = publicUrl(
      requiredString(selection, 'source_page_url', sectionLabel),
      sectionLabel,
    );
    const { page: sourcePage } = uniqueMatch(pages, (item) => item.url === sourcePageUrl, `${sectionLabel} source page ${sourcePageUrl}`);
    if (!sourcePage || !Array.isArray(sourcePage.sections) || !sourcePage.sections.includes(sectionId)) {
      fail(`${sectionLabel}: source page does not support the selected section`);
    }
    const url = publicUrl(requiredString(selection, 'url', sectionLabel), sectionLabel);
    const filePath = optionalString(selection, 'file_path', sectionLabel);
    if (filePath) {
      const { file } = uniqueMatch(files, (item) => item.path === filePath, `${sectionLabel} source file ${filePath}`);
      if (
        !file
        || publicUrl(
          requiredString(file, 'url', `${sectionLabel} selected file`),
          `${sectionLabel} selected file`,
        ) !== url
      ) {
        fail(`${sectionLabel}: selected file does not match the public URL`);
      }
    } else if (url !== sourcePageUrl) {
      fail(`${sectionLabel}: non-file entry must use its selected source page URL`);
    }
    return {
      label: requiredString(selection, 'label_zh', sectionLabel),
      url,
    };
  });
  const url = publicUrl(requiredString(entry, 'site_url', label), label);
  uniqueMatch(pages, (item) => item.url === url, `${label} site URL ${url}`);
  return {
    id: publicId,
    title: requiredString(entry, 'title_zh', label),
    originalTitle,
    summary: requiredString(entry, 'summary_zh', label),
    url,
    sections,
  };
}

function adaptCanonicalResearcher({ entry, label, publicId, recordData }) {
  for (const key of Object.keys(entry)) {
    if (!researcherPublicationFields.has(key)) {
      fail(`${label}: unsupported researcher publication field ${key}`);
    }
  }
  const personId = requiredString(entry, 'record_id', label);
  if (!idPattern.test(personId)) fail(`${label}: invalid canonical person_id`);
  if (!Array.isArray(recordData.records)) fail(`${label}: person registry records must be an array`);
  const matches = recordData.records.filter((record) => record?.person_id === personId);
  if (matches.length !== 1) fail(`${label}: selected canonical person must exist uniquely`);
  const person = object(matches[0], `${label} selected person`);
  const personLabel = `${label} selected person`;
  if (!Array.isArray(entry.resource_kinds)) fail(`${label}: resource_kinds must be an array`);
  const selectedKinds = new Set();
  const resourceUrls = entry.resource_kinds.length ? object(person.resources, `${personLabel} resources`) : {};
  const resources = entry.resource_kinds.map((kind) => {
    if (!researcherResourceKinds.has(kind)) fail(`${label}: resource_kinds: unsupported value`);
    if (selectedKinds.has(kind)) fail(`${label}: resource_kinds: duplicate kind`);
    selectedKinds.add(kind);
    if (!Object.hasOwn(resourceUrls, kind)) fail(`${label}: missing selected resource ${kind}`);
    return { kind, url: publicUrl(resourceUrls[kind], `${personLabel} resources.${kind}`) };
  });
  return {
    id: publicId,
    personId,
    name: requiredString(entry, 'title_zh', label),
    originalName: requiredString(person, 'name_original', personLabel),
    ...(Object.hasOwn(person, 'name_latin') ? { latinName: requiredString(person, 'name_latin', personLabel) } : {}),
    summary: requiredString(entry, 'summary_zh', label),
    ...(Object.hasOwn(person, 'roles') ? { roles: requiredStringArray(person, 'roles', personLabel) } : {}),
    ...(Object.hasOwn(person, 'research_fields') ? { researchFields: requiredStringArray(person, 'research_fields', personLabel) } : {}),
    resources,
  };
}

function adaptBiography({ entry, label, publicId, recordData, recordId, title, readJson }) {
  const sourcePath = requiredString(entry, 'source_path', label);
  const sourceData = readJson(sourcePath, `${label} source_path`);
  if (!Array.isArray(recordData.events)) fail(`${label}: biography events are unavailable`);
  const record = uniqueMatch(recordData.events, (item) => item?.event_id === recordId,
    `${label} selected biography event ${recordId}`);
  const sourceIds = requiredStringArray(entry, 'source_ids', label);
  const availableSources = requiredStringArray(record, 'source_ids', `${label} selected record`);
  if (sourceIds.some((id) => !availableSources.includes(id))) {
    fail(`${label}: selected source is not linked to the biography event`);
  }
  return {
    id: publicId,
    title,
    summary: requiredString(record, 'event_zh', `${label} selected record`),
    period: formatPeriod(record, `${label} selected record`),
    location: optionalString(record, 'location_zh', `${label} selected record`),
    sources: biographySources(sourceData, sourceIds, `${label} sources`),
  };
}

function adaptIfiNetwork({ entry, label, publicId, recordData, recordId, title, readJson, publication }) {
  for (const key of Object.keys(entry)) {
    if (!ifiNetworkPublicationFields.has(key)) {
      fail(`${label}: unsupported IFI network publication field ${key}`);
    }
  }
  if (!Array.isArray(recordData.records)) fail(`${label}: IFI organization catalog is unavailable`);
  const record = uniqueMatch(recordData.records, (item) => item?.organization_id === recordId,
    `${label} selected IFI organization ${recordId}`);
  if (
    recordId !== 'org-ifi'
    || requiredString(record, 'name_en', `${label} selected organization`)
    !== 'International Friends of Ilyenkov'
  ) {
    fail(`${label}: selected organization does not identify International Friends of Ilyenkov`);
  }
  const organizationLabel = `${label} selected organization`;
  const url = publicUrl(requiredString(record, 'url', organizationLabel), organizationLabel);
  const formationEventId = requiredString(record, 'formation_event_id', organizationLabel);
  const events = readJson(ifiEventsRelative, `${label} formation events`);
  if (events.organization_id !== 'org-ifi') {
    fail(`${label}: formation event catalog must belong to org-ifi`);
  }
  if (!Array.isArray(events.activity_groups)) fail(`${label}: formation events are unavailable`);
  const formationEvents = events.activity_groups.filter((event) => event?.event_id === formationEventId);
  if (formationEvents.length !== 1) fail(`${label}: formation event must exist uniquely`);
  const formationEvent = formationEvents[0];
  if (formationEvent.type !== 'symposium' || formationEvent.event_status !== 'confirmed') {
    fail(`${label}: formation event must be a confirmed symposium`);
  }
  const formationPublications = publication.records.filter((selection) => (
    selection?.publication_scope === websiteScope
    && selection.kind === 'ifi_symposium'
    && selection.record_path === ifiEventsRelative
    && selection.record_id === formationEventId
  ));
  if (formationPublications.length !== 1) {
    fail(`${label}: formation event requires a unique website_public IFI symposium publication`);
  }
  const symposiumId = requiredString(formationPublications[0], 'public_id', `${label} formation publication`);
  if (!idPattern.test(symposiumId)) fail(`${label}: formation publication has an invalid public_id`);

  if (!Array.isArray(record.activity_modes)) fail(`${organizationLabel}: activity_modes must be an array`);
  const activityModes = record.activity_modes.map((mode) => {
    if (!ifiActivityModes.has(mode)) fail(`${organizationLabel}: activity_modes: unsupported value`);
    return mode;
  });
  if (!Array.isArray(entry.resource_kinds)) fail(`${label}: resource_kinds must be an array`);
  const selectedKinds = new Set();
  const officialResources = object(record.resources, `${organizationLabel} resources`);
  const resources = entry.resource_kinds.map((kind) => {
    if (!ifiResourceKinds.has(kind)) fail(`${label}: resource_kinds: unsupported value`);
    if (selectedKinds.has(kind)) fail(`${label}: resource_kinds: duplicate kind`);
    selectedKinds.add(kind);
    if (!Object.hasOwn(officialResources, kind)) fail(`${label}: missing selected resource ${kind}`);
    return { kind, url: publicUrl(officialResources[kind], `${organizationLabel} resources.${kind}`) };
  });

  return {
    id: publicId,
    title,
    name: requiredString(record, 'name_en', `${label} selected organization`),
    abbreviation: requiredString(record, 'abbr', `${label} selected organization`),
    summary: requiredString(entry, 'summary_zh', label),
    url,
    formation: { symposiumId },
    activityModes,
    resources,
  };
}

function adaptWork({ entry, label, publicId, recordData, recordId, title, sourceData }) {
  const sourceUrls = requiredStringArray(entry, 'source_urls', label).map((url) => (
    publicUrl(url, label)
  ));
  if (!Array.isArray(recordData.works)) fail(`${label}: works catalog is unavailable`);
  const record = uniqueMatch(recordData.works, (item) => item?.id === recordId,
    `${label} selected work ${recordId}`);
  if (
    record.canonical_work_status !== 'confirmed'
    || record.record_type !== 'author_text'
    || record.responsibility !== 'author_original'
  ) {
    fail(`${label}: selected work is not a confirmed original author text`);
  }
  const year = requiredString(record, 'year', `${label} selected work`);
  if (!/^\d{4}$/.test(year)) fail(`${label}: selected work has no usable original year`);
  return {
    id: publicId,
    title,
    originalTitle: requiredString(record, 'title', `${label} selected work`),
    year,
    type: requiredString(entry, 'work_type_zh', label),
    sources: workSources(sourceData, sourceUrls, recordId, `${label} sources`),
  };
}

function readingsEdition(record, label) {
  const edition = requiredString(record, 'edition_roman', label);
  if (!/^[IVXLCDM]+$/.test(edition) && edition !== 'unnumbered') {
    fail(`${label}: selected event is not a Readings edition`);
  }
  return record;
}

function readingsEventByDirectory(recordData, directory, label) {
  if (!Array.isArray(recordData.conferences)) fail(`${label}: readings catalog is unavailable`);
  const matches = recordData.conferences.filter((item) => item?.local_directory === directory);
  if (matches.length !== 1) fail(`${label}: readings directory must match exactly one event`);
  return readingsEdition(matches[0], label);
}

function selectedReadingsEvent(entry, recordData, label) {
  if (entry.record_path !== readingsEventsRelative) {
    fail(`${label}: Readings record_path must use ${readingsEventsRelative}`);
  }
  if (Object.hasOwn(entry, 'record_id')) {
    fail(`${label}: Readings event publication must use record_directory, not record_id`);
  }
  return readingsEventByDirectory(recordData, requiredString(entry, 'record_directory', label), label);
}

function adaptReadingsSeries({ entry, label, publicId, recordData, recordId, title, readJson, publication }) {
  for (const key of Object.keys(entry)) {
    if (!readingsSeriesPublicationFields.has(key)) {
      fail(`${label}: unsupported Readings series publication field ${key}`);
    }
  }
  if (entry.record_path !== readingsSeriesRelative) {
    fail(`${label}: Readings series record_path must use ${readingsSeriesRelative}`);
  }
  if (!Array.isArray(recordData.records)) fail(`${label}: readings series catalog is unavailable`);
  const matches = recordData.records.filter((record) => record?.series_id === recordId);
  if (matches.length !== 1) fail(`${label}: selected readings series must exist uniquely`);
  const record = matches[0];
  if (record.type !== 'academic_conference_series') {
    fail(`${label}: selected series must be an academic_conference_series`);
  }
  const seriesLabel = `${label} selected series`;
  const events = readJson(readingsEventsRelative, `${label} history events`);
  const historyRelation = (key, accepts) => {
    const directory = requiredString(record, key, seriesLabel);
    const event = readingsEventByDirectory(events, directory, `${label} ${key}`);
    if (accepts && !accepts(event)) fail(`${label}: invalid ${key} event`);
    const selections = publication.records.filter((selection) => (
      selection?.publication_scope === websiteScope && selection.kind === 'ilyenkov_readings'
      && selectedReadingsEvent(selection, events, `${label} history publication`).local_directory === directory
    ));
    if (selections.length !== 1) {
      fail(`${label}: ${key} requires a unique website_public Readings publication`);
    }
    const id = requiredString(selections[0], 'public_id', `${label} history publication`);
    if (!idPattern.test(id)) fail(`${label}: history publication has an invalid public_id`);
    return id;
  };
  const history = {
    earliestArchivedEventId: historyRelation('earliest_archived_event_directory'),
    firstInternationalEventId: historyRelation('first_international_event_directory', (event) => (
      event.edition_roman === 'I'
    )),
  };
  if (!Array.isArray(entry.resource_kinds)) fail(`${label}: resource_kinds must be an array`);
  const resourceUrls = object(record.resources, `${seriesLabel} resources`);
  const selectedKinds = new Set();
  const resources = entry.resource_kinds.map((kind) => {
    if (!readingsResourceKinds.has(kind)) fail(`${label}: resource_kinds: unsupported value`);
    if (selectedKinds.has(kind)) fail(`${label}: resource_kinds: duplicate kind`);
    selectedKinds.add(kind);
    if (!Object.hasOwn(resourceUrls, kind)) fail(`${label}: missing selected resource ${kind}`);
    return { kind, url: publicUrl(resourceUrls[kind], `${seriesLabel} resources.${kind}`) };
  });
  return {
    id: publicId,
    title,
    name: requiredString(record, 'name_ru', seriesLabel),
    summary: requiredString(entry, 'summary_zh', label),
    type: record.type,
    history,
    resources,
  };
}

function adaptReadings({ entry, label, publicId, recordData, sourceData, sourcePath }) {
  if (Object.hasOwn(entry, 'title_zh')) fail(`${label}: Readings title_zh belongs to the canonical event`);
  const sourceIds = requiredStringArray(entry, 'source_ids', label);
  const record = selectedReadingsEvent(entry, recordData, label);
  const directory = requiredString(record, 'local_directory', `${label} selected record`);
  if (sourcePath !== `research/readings/${directory}/sources.json`) {
    fail(`${label}: selected source path is not the Readings event source directory`);
  }
  const start = optionalString(record, 'start_date', `${label} selected record`);
  const end = optionalString(record, 'end_date', `${label} selected record`);
  if (!start || !end || !datePattern.test(start) || !datePattern.test(end)) {
    fail(`${label}: selected readings record has no usable historical dates`);
  }
  const title = requiredString(record, 'title_zh', `${label} selected record`);
  const recordFormat = requiredString(record, 'format', `${label} selected record`);
  if (!['in_person', 'online'].includes(recordFormat)) {
    fail(`${label}: selected readings format is unsupported`);
  }
  const isOnline = recordFormat === 'online';
  const location = isOnline ? null : requiredString(entry, 'location_zh', label);
  const format = isOnline ? requiredString(entry, 'format_zh', label) : null;
  if (isOnline && optionalString(entry, 'location_zh', label)) {
    fail(`${label}: online readings must not declare a location`);
  }
  if (!isOnline && optionalString(entry, 'format_zh', label)) {
    fail(`${label}: in-person readings must not declare an activity format`);
  }
  return {
    id: publicId,
    edition: requiredString(entry, 'edition_zh', label),
    title,
    location,
    format,
    period: { start, end },
    sources: readingSources(
      sourceData,
      sourceIds,
      `${label} sources`,
      isOnline ? ['online_format'] : [],
    ),
  };
}

function adaptIfiSymposium({ entry, label, publicId, recordData, recordId, title, sourceData, sourcePath }) {
  if (!Array.isArray(recordData.activity_groups)) fail(`${label}: IFI events catalog is unavailable`);
  const record = uniqueMatch(recordData.activity_groups, (item) => item?.event_id === recordId,
    `${label} selected IFI symposium ${recordId}`);
  if (record.type !== 'symposium' || record.event_status !== 'confirmed') {
    fail(`${label}: selected IFI event is not a confirmed symposium`);
  }
  const directory = requiredString(record, 'local_directory', `${label} selected record`);
  if (sourcePath !== `research/friends/${directory}/sources.json`) {
    fail(`${label}: selected source path is not the symposium source directory`);
  }
  const start = requiredString(record, 'start_date', `${label} selected record`);
  const end = requiredString(record, 'end_date', `${label} selected record`);
  if (!datePattern.test(start) || !datePattern.test(end)) {
    fail(`${label}: selected IFI symposium has no usable historical dates`);
  }
  const sourceIds = requiredStringArray(entry, 'source_ids', label);
  return {
    id: publicId,
    title,
    context: requiredString(entry, 'context_zh', label),
    location: requiredString(entry, 'location_zh', label),
    period: { start, end },
    sources: ifiSources(sourceData, sourceIds, `${label} sources`),
  };
}

function adaptMilitary({ entry, label, publicId, recordData, recordId, title, sourceData }) {
  const sourceIds = requiredStringArray(entry, 'source_ids', label);
  if (!Array.isArray(recordData.timeline)) fail(`${label}: military timeline is unavailable`);
  const record = uniqueMatch(recordData.timeline, (item) => item?.event_id === recordId,
    `${label} selected military record ${recordId}`);
  const availableSources = requiredStringArray(record, 'source_ids', `${label} selected record`);
  if (sourceIds.some((id) => !availableSources.includes(id))) {
    fail(`${label}: selected source is not linked to the record`);
  }
  return {
    id: publicId,
    title,
    summary: requiredString(record, 'event_zh', `${label} selected record`),
    period: formatPeriod(record, `${label} selected record`),
    sources: sourceRecords(sourceData, sourceIds, `${label} sources`),
  };
}

function adaptCongress({ entry, label, publicId, recordData, recordId, title, sourceData }) {
  const sourceIds = requiredStringArray(entry, 'source_ids', label);
  if (!Array.isArray(recordData.events)) fail(`${label}: congress events are unavailable`);
  const record = uniqueMatch(recordData.events, (item) => item?.event_id === recordId,
    `${label} selected congress record ${recordId}`);
  const availableSources = sourceIdsIn(record);
  if (sourceIds.some((id) => !availableSources.has(id))) {
    fail(`${label}: selected source is not linked to the record`);
  }
  const summary = requiredString(entry, 'summary_zh', label);
  const status = requiredString(entry, 'status_zh', label);
  const start = optionalString(record, 'start_date', `${label} selected record`);
  const end = optionalString(record, 'end_date', `${label} selected record`);
  if ((!start && !end) || (start && !datePattern.test(start)) || (end && !datePattern.test(end))) {
    fail(`${label}: congress event has no usable historical date`);
  }
  return {
    id: publicId,
    title,
    summary,
    status,
    period: { start: start ?? end, end: end ?? start },
    location: requiredString(record, 'city', `${label} selected record`),
    sources: sourceRecords(sourceData, sourceIds, `${label} sources`),
  };
}

export function plannedResearchRecords({ projectRoot, researchRoot }) {
  if (researchRoot === projectRoot) fail('Ilyenkov source cannot be the public repository');
  const readJson = (relative, label) => readResearchJson(researchRoot, relative, label);
  const readEditorial = (relative, label) => {
    if (!/^web\/editorial\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(relative)) {
      fail(`${label}: editorial_path must use web/editorial/<slug>.json`);
    }
    const file = resolveResearchPath(researchRoot, relative, `${label} editorial_path`);
    if (!existsSync(file)) fail(`missing ${relative}`);
    const editorialRoot = `${path.join(realpathSync(researchRoot), 'web', 'editorial')}${path.sep}`;
    if (!realpathSync(file).startsWith(editorialRoot)) fail(`${label}: editorial_path escapes web/editorial`);
    return readJson(relative, `${label} editorial_path`);
  };
  const selectedEditorial = (entry, label, kind) => {
    if (!Object.hasOwn(entry, 'editorial_path')) return {};
    const manuscript = readEditorial(requiredString(entry, 'editorial_path', label), label);
    const fields = kind === 'ifi_network' ? ['introduction', 'symposiumsLead']
      : kind === 'researcher_profile' ? ['introduction', 'workDescription'] : ['introduction'];
    for (const key of Object.keys(manuscript)) {
      if (!fields.includes(key)) fail(`${label}: unsupported editorial field ${key}`);
    }
    return {
      editorial: {
        introduction: requiredStringArray(manuscript, 'introduction', `${label} editorial`),
        ...(kind === 'ifi_network' ? {
          symposiumsLead: requiredString(manuscript, 'symposiumsLead', `${label} editorial`),
        } : {}),
        ...(kind === 'researcher_profile' ? {
          workDescription: requiredString(manuscript, 'workDescription', `${label} editorial`),
        } : {}),
      },
    };
  };
  const publication = readJson(publicationRelative, publicationRelative);
  if (!Array.isArray(publication.records)) {
    fail(`${publicationRelative}: records must be an array`);
  }
  const seen = new Set();
  const records = {
    biography: [],
    military: [],
    congresses: [],
    works: [],
    readings: [],
    ifiNetworks: [],
    ifiSymposiums: [],
    researchers: [],
    researchSites: [],
  };

  let profileSelection;
  for (const [index, rawEntry] of publication.records.entries()) {
    const label = `${publicationRelative} records[${index}]`;
    const entry = object(rawEntry, label);
    if (entry.publication_scope !== websiteScope) continue;
    const publicId = requiredString(entry, 'public_id', label);
    if (!idPattern.test(publicId) || seen.has(publicId)) {
      fail(`${label}: invalid or duplicate public_id`);
    }
    seen.add(publicId);
    const kind = requiredString(entry, 'kind', label);
    if (!supportedKinds.has(kind)) fail(`${label}: unsupported kind`);
    const recordPath = requiredString(entry, 'record_path', label);
    if (kind === 'ilyenkov_profile') {
      if (profileSelection) fail(`${label}: duplicate Ilyenkov profile selection`);
      profileSelection = { entry, label, publicId };
      continue;
    }
    if (kind === 'researcher_profile') {
      if (recordPath !== personsRelative) {
        fail(`${label}: researcher record_path must use ${personsRelative}`);
      }
      records.researchers.push({
        ...adaptCanonicalResearcher({
          entry,
          label,
          publicId,
          recordData: readJson(personsRelative, `${label} record_path`),
        }),
        ...selectedEditorial(entry, label, kind),
      });
      continue;
    }
    const recordData = readJson(recordPath, `${label} record_path`);

    if (kind === 'research_site') {
      records.researchSites.push(adaptResearchSite({ entry, label, publicId, recordData }));
      continue;
    }
    const recordId = kind === 'ilyenkov_readings' ? null : requiredString(entry, 'record_id', label);
    const title = kind === 'ilyenkov_readings' ? undefined : requiredString(entry, 'title_zh', label);
    const common = { entry, label, publicId, recordData, recordId, title };

    if (kind === 'biography_event') {
      records.biography.push(adaptBiography({ ...common, readJson }));
      continue;
    }
    if (kind === 'ifi_network') {
      records.ifiNetworks.push({
        ...adaptIfiNetwork({ ...common, readJson, publication }),
        ...selectedEditorial(entry, label, kind),
      });
      continue;
    }
    if (kind === 'ilyenkov_readings_series') {
      // Omit this collection entirely until publication enables it, preserving current input.
      records.readingsSeries ??= [];
      records.readingsSeries.push({
        ...adaptReadingsSeries({ ...common, readJson, publication }),
        ...selectedEditorial(entry, label, kind),
      });
      continue;
    }

    const sourcePath = requiredString(entry, 'source_path', label);
    const sourceData = readJson(sourcePath, `${label} source_path`);
    const sourced = { ...common, sourceData, sourcePath };
    if (kind === 'works_catalog') records.works.push(adaptWork(sourced));
    else if (kind === 'ilyenkov_readings') records.readings.push(adaptReadings(sourced));
    else if (kind === 'ifi_symposium') {
      records.ifiSymposiums.push(adaptIfiSymposium({ ...sourced, sourcePath }));
    } else if (kind === 'military_service') records.military.push(adaptMilitary(sourced));
    else records.congresses.push(adaptCongress(sourced));
  }

  if (Object.values(records).some((selected) => selected.length === 0)) {
    fail('website_public selection must include biography, military, congress, works, readings, IFI network, IFI symposium, researcher, and research site records');
  }
  const timelineLabel = `${publicationRelative} timeline`;
  const timeline = object(publication.timeline, timelineLabel);
  const worksLabel = `${publicationRelative} works_catalog`;
  const worksCatalog = object(publication.works_catalog, worksLabel);
  const allowedFields = (value, fields, label) => {
    for (const key of Object.keys(value)) {
      if (!fields.includes(key)) fail(`${label}: unsupported field ${key}`);
    }
  };
  allowedFields(timeline, ['record_kinds', 'editorial_path'], timelineLabel);
  allowedFields(worksCatalog, ['editorial_path'], worksLabel);
  const timelineCollections = {
    biography_event: 'biography',
    military_service: 'military',
    hegel_congress: 'congresses',
  };
  if (!Array.isArray(timeline.record_kinds)) fail(`${timelineLabel}: record_kinds must be an array`);
  const selectedKinds = new Set();
  const recordIds = timeline.record_kinds.flatMap((kind) => {
    if (typeof kind !== 'string' || !Object.hasOwn(timelineCollections, kind)) {
      fail(`${timelineLabel}: record_kinds: unsupported kind`);
    }
    if (selectedKinds.has(kind)) fail(`${timelineLabel}: record_kinds: duplicate kind`);
    selectedKinds.add(kind);
    return records[timelineCollections[kind]].map((record) => record.id);
  });
  const timelineEditorial = readEditorial(requiredString(timeline, 'editorial_path', timelineLabel), timelineLabel);
  allowedFields(timelineEditorial, ['description'], `${timelineLabel} editorial`);
  records.timeline = {
    recordIds,
    editorial: { description: requiredString(timelineEditorial, 'description', `${timelineLabel} editorial`) },
  };

  const worksEditorial = readEditorial(requiredString(worksCatalog, 'editorial_path', worksLabel), worksLabel);
  const worksEditorialLabel = `${worksLabel} editorial`;
  allowedFields(worksEditorial, ['description', 'lead', 'note', 'typeNotes'], worksEditorialLabel);
  const typeNotes = object(worksEditorial.typeNotes, `${worksEditorialLabel} typeNotes`);
  const publicTypes = new Set(records.works.map((work) => work.type));
  records.worksCatalog = {
    editorial: {
      description: requiredString(worksEditorial, 'description', worksEditorialLabel),
      lead: requiredString(worksEditorial, 'lead', worksEditorialLabel),
      note: requiredString(worksEditorial, 'note', worksEditorialLabel),
      typeNotes: Object.fromEntries(Object.keys(typeNotes).map((type) => {
        if (!publicTypes.has(type)) fail(`${worksEditorialLabel}: typeNotes must reference a public work type`);
        return [type, requiredString(typeNotes, type, `${worksEditorialLabel} typeNotes`)];
      })),
    },
  };
  const pageCollections = { ...timelineCollections, works_catalog: 'works' };
  const publicPageRecords = Object.entries(pageCollections).flatMap(([kind, collection]) => (
    records[collection].map((record) => ({ kind, record }))
  ));
  const selectReferences = (ids, available, label) => {
    if (!Array.isArray(ids)) fail(`${label}: record_ids must be an array`);
    const seenIds = new Set();
    return ids.map((id) => {
      if (typeof id !== 'string' || !idPattern.test(id) || seenIds.has(id)) {
        fail(`${label}: invalid or duplicate record reference`);
      }
      seenIds.add(id);
      const matches = available.filter(({ record }) => record.id === id);
      if (matches.length !== 1) fail(`${label}: reference must identify exactly one approved public record`);
      return matches[0];
    });
  };
  const pageEditorial = (key) => {
    const label = `${publicationRelative} ${key}`;
    const selection = object(publication[key], label);
    allowedFields(selection, ['editorial_path'], label);
    return readEditorial(requiredString(selection, 'editorial_path', label), label);
  };

  const lifeEditorial = pageEditorial('life');
  const lifeLabel = `${publicationRelative} life editorial`;
  allowedFields(lifeEditorial, ['description', 'lead', 'note', 'stages'], lifeLabel);
  if (!Array.isArray(lifeEditorial.stages)) fail(`${lifeLabel}: stages must be an array`);
  records.life = {
    description: requiredString(lifeEditorial, 'description', lifeLabel),
    lead: requiredString(lifeEditorial, 'lead', lifeLabel),
    note: requiredString(lifeEditorial, 'note', lifeLabel),
    stages: lifeEditorial.stages.map((rawStage, index) => {
      const label = `${lifeLabel} stages[${index}]`;
      const stage = object(rawStage, label);
      allowedFields(stage, ['title', 'record_ids', 'record_kind', 'summary', 'links'], label);
      const byKind = Object.hasOwn(stage, 'record_kind');
      if (byKind === Object.hasOwn(stage, 'record_ids')) {
        fail(`${label}: exactly one of record_ids or record_kind is required`);
      }
      let selected;
      if (byKind) {
        const kind = requiredString(stage, 'record_kind', label);
        if (!Object.hasOwn(pageCollections, kind)) fail(`${label}: unsupported record_kind`);
        selected = publicPageRecords.filter((item) => item.kind === kind);
      } else {
        selected = selectReferences(stage.record_ids, publicPageRecords, label);
      }
      const works = selected.filter((item) => item.kind === 'works_catalog');
      if (works.length && works.length !== selected.length) fail(`${label}: work and activity references cannot be mixed`);
      const isWorkStage = works.length > 0 || stage.record_kind === 'works_catalog';
      if (isWorkStage && !Object.hasOwn(stage, 'summary')) fail(`${label}: work references require an editorial summary`);
      const coordinates = selected.length === 0 ? {} : isWorkStage ? {
        years: [...new Set(works.map(({ record }) => record.year))].sort(),
      } : {
        period: {
          start: selected.map(({ record }) => record.period.start).sort()[0],
          end: selected.map(({ record }) => record.period.end).sort().at(-1),
        },
      };
      if (!Array.isArray(stage.links)) fail(`${label}: links must be an array`);
      return {
        title: requiredString(stage, 'title', label),
        recordIds: selected.map(({ record }) => record.id),
        ...(Object.hasOwn(stage, 'summary') ? { summary: requiredString(stage, 'summary', label) } : {}),
        ...coordinates,
        links: stage.links.map((rawLink, linkIndex) => {
          const linkLabel = `${label} links[${linkIndex}]`;
          const link = object(rawLink, linkLabel);
          allowedFields(link, ['target', 'label'], linkLabel);
          const target = requiredString(link, 'target', linkLabel);
          if (!['timeline', 'circle', 'works'].includes(target)) fail(`${linkLabel}: unsupported link target`);
          return { target, label: requiredString(link, 'label', linkLabel) };
        }),
      };
    }),
  };

  const circleEditorial = pageEditorial('circle');
  const circleLabel = `${publicationRelative} circle editorial`;
  allowedFields(circleEditorial, ['description', 'sections'], circleLabel);
  if (!Array.isArray(circleEditorial.sections)) fail(`${circleLabel}: sections must be an array`);
  const sectionKinds = new Set();
  records.circle = {
    description: requiredString(circleEditorial, 'description', circleLabel),
    sections: circleEditorial.sections.map((rawSection, index) => {
      const label = `${circleLabel} sections[${index}]`;
      const section = object(rawSection, label);
      allowedFields(section, ['title', 'lead', 'record_kind', 'record_ids'], label);
      const kind = requiredString(section, 'record_kind', label);
      if (!['military_service', 'hegel_congress'].includes(kind)) fail(`${label}: unsupported record_kind`);
      if (sectionKinds.has(kind)) fail(`${label}: duplicate section record_kind`);
      sectionKinds.add(kind);
      const available = publicPageRecords.filter((item) => item.kind === kind);
      const selected = Object.hasOwn(section, 'record_ids')
        ? selectReferences(section.record_ids, available, label) : available;
      return {
        recordKind: kind,
        title: requiredString(section, 'title', label),
        lead: requiredString(section, 'lead', label),
        recordIds: selected.map(({ record }) => record.id),
      };
    }),
  };
  if (profileSelection) {
    const { entry, label, publicId } = profileSelection;
    allowedFields(entry, ['public_id', 'publication_scope', 'kind', 'record_path', 'record_id',
      'title_zh', 'birth_record_id', 'editorial_path'], label);
    if (entry.record_path !== personsRelative) fail(`${label}: profile record_path must use ${personsRelative}`);
    const registry = object(readJson(personsRelative, label), label);
    if (!Array.isArray(registry.records)) fail(`${label}: person records must be an array`);
    const personId = requiredString(entry, 'record_id', label);
    if (!idPattern.test(personId)) fail(`${label}: invalid person identity`);
    const person = uniqueMatch(registry.records, (record) => record.person_id === personId, `${label} person identity`);
    const birth = uniqueMatch(records.biography,
      (record) => record.id === requiredString(entry, 'birth_record_id', label), `${label} public birth reference`);
    const deathYear = requiredString(person, 'death_year', label);
    if (!/^\d{4}$/.test(deathYear)) fail(`${label}: invalid death_year`);
    const identity = requiredString(entry, 'title_zh', label);
    const originalName = requiredString(person, 'name_original', label);
    const lifespan = `${birth.period.start.slice(0, 4)}—${deathYear}`;
    const manuscript = object(readEditorial(requiredString(entry, 'editorial_path', label), label), label);
    allowedFields(manuscript, ['summary', 'description', 'introduction', 'entrances'], `${label} editorial`);
    const replacements = { identity, originalName, lifespan };
    const introduction = requiredStringArray(manuscript, 'introduction', label).map((paragraph) => (
      paragraph.replace(/\{\{([^{}]+)\}\}/g, (_match, field) => {
        if (!Object.hasOwn(replacements, field)) fail(`${label}: unsupported introduction reference ${field}`);
        return replacements[field];
      })
    ));
    if (!Array.isArray(manuscript.entrances)) fail(`${label}: entrances must be an array`);
    const targets = new Set();
    records.ilyenkov = {
      id: publicId, personId, identity, originalName, lifespan,
      summary: requiredString(manuscript, 'summary', label),
      description: requiredString(manuscript, 'description', label),
      introduction,
      entrances: manuscript.entrances.map((rawEntrance, index) => {
        const entranceLabel = `${label} entrances[${index}]`;
        const entrance = object(rawEntrance, entranceLabel);
        allowedFields(entrance, ['target', 'label', 'summary'], entranceLabel);
        const target = requiredString(entrance, 'target', entranceLabel);
        if (!['life', 'timeline', 'works', 'circle'].includes(target) || targets.has(target)) {
          fail(`${entranceLabel}: invalid or duplicate target`);
        }
        targets.add(target);
        return { target, label: requiredString(entrance, 'label', entranceLabel),
          summary: requiredString(entrance, 'summary', entranceLabel) };
      }),
    };
  }
  return records;
}
