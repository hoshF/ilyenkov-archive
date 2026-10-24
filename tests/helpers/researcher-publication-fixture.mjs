import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { plannedResearchOutputs, plannedResearchRecords } from '../../scripts/lib/research-sync/planner.mjs';

export const publicationPath = 'web/publication.json';
export const personsPath = 'people/persons.json';
export const personId = 'person-fixture-researcher';
export const researcherId = 'researcher-fixture';
export const readJson = (root, relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const projectRoot = process.cwd();

/** Synthetic supporting records satisfy the real planner's required collections, not other channel tests. */
function seed(write) {
  const sourceId = 'source-fixture';
  const sources = { records: [{ source_id: sourceId, title: 'Synthetic evidence',
    url: 'https://example.test/evidence', supports: [
      'biographical_fact', 'historical_date', 'conference_title', 'conference_dates',
      'activity_title', 'activity_dates', 'activity_location',
    ] }] };
  write('research/fixture/sources.json', sources);
  write(personsPath, { records: [
    { person_id: personId, name_original: 'Synthetic Researcher', name_latin: 'Fixture Person',
      roles: ['researcher'], research_fields: ['Synthetic field'], resources: {
        personal: 'https://example.test/person', orcid: 'https://example.test/orcid',
        institution: 'https://example.test/institution',
      } },
    { person_id: 'person-fixture-secondary', name_original: 'Synthetic Secondary Researcher' },
  ] });
  write('web/editorial/fixture-researcher.json', {
    introduction: ['Synthetic researcher introduction.'], workDescription: 'Synthetic research description.',
  });
  write('research/fixture/biography.json', { events: [{ event_id: 'fixture-birth',
    event_zh: 'Synthetic biographical fact.', date: '2000-01-01', source_ids: [sourceId] }] });
  write('research/fixture/military.json', { timeline: [{ event_id: 'fixture-service',
    event_zh: 'Synthetic service fact.', date: '2001-01-01', source_ids: [sourceId] }] });
  write('research/fixture/congress.json', { events: [{ event_id: 'fixture-congress',
    start_date: '2002-01-01', end_date: '2002-01-02', city: 'Synthetic city', sources: [sourceId] }] });
  write('research/fixture/works.json', { works: [{ id: 'fixture-work', title: 'Synthetic work',
    canonical_work_status: 'confirmed', record_type: 'author_text', responsibility: 'author_original', year: '2000' }] });
  write('research/fixture/work-sources.json', { sources: [{ url: 'https://example.test/work',
    work_id: 'fixture-work', kind: 'record', title: 'Synthetic bibliographic source' }] });
  write('research/readings/events.json', { conferences: [{ local_directory: 'events/fixture',
    edition_roman: 'I', title_zh: '虚构会议', start_date: '2003-01-01', end_date: '2003-01-02', format: 'in_person' }] });
  write('research/readings/events/fixture/sources.json', sources);
  // These two identities are required by the production IFI adapter, not copied research content.
  write('research/friends/organization.json', { records: [{ organization_id: 'org-ifi',
    name_en: 'International Friends of Ilyenkov', abbr: 'IFI', url: 'https://example.test/network',
    formation_event_id: 'fixture-symposium', activity_modes: ['symposium'], resources: {} }] });
  write('research/friends/events.json', { organization_id: 'org-ifi', activity_groups: [{
    event_id: 'fixture-symposium', type: 'symposium', event_status: 'confirmed',
    local_directory: 'events/fixture', start_date: '2004-01-01', end_date: '2004-01-02', format: 'in_person',
  }] });
  write('research/friends/events/fixture/sources.json', sources);
  write('research/fixture/site.json', { site: 'Synthetic research site',
    source_pages: [{ page: 'https://example.test/site', sections: ['fixture-section'] }],
    files: [], sections: { 'fixture-section': 'Synthetic section' } });
  write('web/editorial/fixture-timeline.json', { description: 'Synthetic timeline.' });
  write('web/editorial/fixture-works.json', { description: 'Synthetic works.', lead: 'Synthetic lead.', note: 'Synthetic note.', typeNotes: {} });
  write('web/editorial/fixture-life.json', { description: 'Synthetic life.', lead: 'Synthetic lead.', note: 'Synthetic note.', stages: [] });
  write('web/editorial/fixture-circle.json', { description: 'Synthetic circle.', sections: [] });

  const selected = (public_id, kind, record_path, fields) => ({
    public_id, publication_scope: 'website_public', kind, record_path, ...fields,
  });
  const sourced = (publicId, kind, recordPath, recordId, fields = {}) => selected(publicId, kind, recordPath, {
    record_id: recordId, title_zh: '虚构记录', source_path: 'research/fixture/sources.json', source_ids: [sourceId], ...fields,
  });
  write(publicationPath, { works: [], records: [
    selected(researcherId, 'researcher_profile', personsPath, { record_id: personId,
      title_zh: '虚构研究者', summary_zh: '虚构人物摘要。', resource_kinds: ['personal', 'orcid'],
      editorial_path: 'web/editorial/fixture-researcher.json' }),
    selected('researcher-fixture-secondary', 'researcher_profile', personsPath, { record_id: 'person-fixture-secondary',
      title_zh: '另一位虚构研究者', summary_zh: '虚构备用摘要。', resource_kinds: [] }),
    sourced('fixture-biography', 'biography_event', 'research/fixture/biography.json', 'fixture-birth'),
    sourced('fixture-military', 'military_service', 'research/fixture/military.json', 'fixture-service'),
    sourced('fixture-congress', 'hegel_congress', 'research/fixture/congress.json', 'fixture-congress', { summary_zh: '虚构会议摘要。', status_zh: '确认' }),
    selected('fixture-work', 'works_catalog', 'research/fixture/works.json', { record_id: 'fixture-work',
      title_zh: '虚构作品', work_type_zh: '著作', source_path: 'research/fixture/work-sources.json', source_urls: ['https://example.test/work'] }),
    selected('fixture-reading', 'ilyenkov_readings', 'research/readings/events.json', {
      record_directory: 'events/fixture', edition_zh: '第一届', location_zh: '虚构地点',
      source_path: 'research/readings/events/fixture/sources.json', source_ids: [sourceId] }),
    selected('fixture-network', 'ifi_network', 'research/friends/organization.json', { record_id: 'org-ifi',
      title_zh: '虚构网络介绍', summary_zh: '虚构网络摘要。', resource_kinds: [] }),
    sourced('fixture-symposium', 'ifi_symposium', 'research/friends/events.json', 'fixture-symposium', {
      context_zh: '虚构活动背景。', location_zh: '虚构地点', source_path: 'research/friends/events/fixture/sources.json' }),
    selected('fixture-site', 'research_site', 'research/fixture/site.json', { original_title: 'Synthetic research site',
      title_zh: '虚构资料站', summary_zh: '虚构资料站摘要。', site_url: 'https://example.test/site',
      sections: [{ section_id: 'fixture-section', source_page_url: 'https://example.test/site',
        url: 'https://example.test/site', label_zh: '虚构资料' }] }),
  ], timeline: { record_kinds: [], editorial_path: 'web/editorial/fixture-timeline.json' },
  works_catalog: { editorial_path: 'web/editorial/fixture-works.json' },
  life: { editorial_path: 'web/editorial/fixture-life.json' },
  circle: { editorial_path: 'web/editorial/fixture-circle.json' } });
}

/** The caller owns cleanup; no real publication manifest, manuscripts or generated inputs are read. */
export function researcherFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ilyenkov-researcher-contract-'));
  const sourceRoot = path.join(root, 'research-source');
  const publicRoot = path.join(root, 'public');
  const writeBytes = (relative, content) => {
    const file = path.join(sourceRoot, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  const write = (relative, data) => writeBytes(relative, `${JSON.stringify(data, null, 2)}\n`);
  seed(write);
  return {
    root, sourceRoot, publicRoot,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
    run(checkOnly = false, nodeArgs = []) {
      mkdirSync(path.join(publicRoot, 'scripts'), { recursive: true });
      cpSync(path.join(projectRoot, 'scripts/lib'), path.join(publicRoot, 'scripts/lib'), { recursive: true });
      cpSync(path.join(projectRoot, 'scripts/sync-research-records.mjs'), path.join(publicRoot, 'scripts/sync-research-records.mjs'));
      mkdirSync(path.join(publicRoot, 'src/lib'), { recursive: true });
      cpSync(path.join(projectRoot, 'src/lib/research-record.mjs'), path.join(publicRoot, 'src/lib/research-record.mjs'));
      if (!existsSync(path.join(publicRoot, 'node_modules'))) symlinkSync(path.join(projectRoot, 'node_modules'), path.join(publicRoot, 'node_modules'), 'dir');
      return spawnSync(process.execPath, [...nodeArgs, 'scripts/sync-research-records.mjs', ...(checkOnly ? ['--check'] : [])], {
        cwd: publicRoot, env: { ...process.env, ILYENKOV_ROOT: sourceRoot }, encoding: 'utf8', timeout: 10_000,
      });
    },
    generated: () => readJson(publicRoot, '.website-input/research-records.json'),
    generatedPortrait: (filename) => path.join(publicRoot, '.website-input/portraits', filename),
    writeBytes, write,
    remove: (relative) => rmSync(path.join(sourceRoot, relative)),
    read: (relative) => readJson(sourceRoot, relative),
    mutate(relative, callback) {
      const data = this.read(relative); callback(data); write(relative, data);
    },
    plan: () => plannedResearchRecords({ projectRoot, researchRoot: sourceRoot }),
    outputs: () => plannedResearchOutputs({ projectRoot, researchRoot: sourceRoot }),
  };
}
