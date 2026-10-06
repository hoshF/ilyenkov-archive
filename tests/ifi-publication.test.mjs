import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { plannedResearchRecords } from '../scripts/lib/research-sync/planner.mjs';
import { IfiNetworkSchema, ResearchRecordsSchema } from '../src/lib/research-records';
import { builtRoutePath, pageFileExists } from './helpers/pages';
import { researchRoot } from './helpers/publication';

const projectRoot = process.cwd();
const publicationPath = 'research/publication.json';
const organizationPath = 'research/friends/organization.json';
const eventsPath = 'research/friends/events.json';
const activityModes = ['symposium', 'webinar', 'collective_reading', 'discussion'];
const resourceKinds = ['about', 'history', 'texts', 'symposiums', 'youtube', 'facebook'];
const readJson = (root, relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const publication = readJson(researchRoot, publicationPath);
const selectedEntries = publication.records.filter((entry) => entry.publication_scope === 'website_public');
const privateOrganization = readJson(researchRoot, organizationPath).records.find((record) => (
  record.organization_id === 'org-ifi'
));
const selectedNetwork = selectedEntries.find((entry) => entry.kind === 'ifi_network');
const roots = [];

afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

/** Copy only manifest-referenced JSON, never research bodies, snapshots or attachments. */
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ilyenkov-ifi-contract-'));
  roots.push(root);
  const sourceRoot = path.join(root, 'research-source');
  const outputRoot = path.join(root, 'generated');
  const relativePaths = new Set([publicationPath, eventsPath]);
  selectedEntries.forEach((entry) => {
    for (const field of ['record_path', 'source_path']) {
      if (entry[field]) relativePaths.add(entry[field]);
    }
  });
  for (const relative of relativePaths) {
    const target = path.join(sourceRoot, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(path.join(researchRoot, relative), 'utf8'));
  }
  // The researcher adapter only needs the approved translation identity here.
  // This is a temporary title header, not a copy of any translation body.
  for (const entry of selectedEntries.filter((record) => record.kind === 'researcher_profile')) {
    for (const work of entry.works) {
      const target = path.join(outputRoot, 'articles', `${work.archive_id}.md`);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, `---\ntitle_zh: ${JSON.stringify(work.title_zh)}\n---\n`);
    }
  }
  return {
    read: (relative) => readJson(sourceRoot, relative),
    write(relative, data) {
      writeFileSync(path.join(sourceRoot, relative), `${JSON.stringify(data, null, 2)}\n`);
    },
    mutate(relative, callback) {
      const data = this.read(relative);
      callback(data);
      this.write(relative, data);
    },
    plan: () => plannedResearchRecords({ projectRoot, researchRoot: sourceRoot, outputRoot }),
  };
}

const networkEntry = (manifest) => manifest.records.find((entry) => entry.kind === 'ifi_network');
const organization = (catalog) => catalog.records.find((record) => record.organization_id === 'org-ifi');
const formationEvent = (catalog) => catalog.activity_groups.find((record) => (
  record.event_id === privateOrganization.formation_event_id
));
const formationPublication = (manifest) => manifest.records.find((entry) => (
  entry.kind === 'ifi_symposium' && entry.record_id === privateOrganization.formation_event_id
));

describe('IFI publication contract', () => {
  it('consumes the current private contract and matches the generated public input', () => {
    const records = plannedResearchRecords({
      projectRoot,
      researchRoot,
      outputRoot: path.join(projectRoot, '.website-input'),
    });
    expect(ResearchRecordsSchema.safeParse(records).success).toBe(true);
    expect(records).toEqual(readJson(projectRoot, '.website-input/research-records.json'));
    const network = records.ifiNetworks[0];
    expect(network.url).toBe(privateOrganization.url);
    expect(network.summary).toBe(selectedNetwork.summary_zh);
    expect(network.activityModes).toEqual(privateOrganization.activity_modes);
    expect(network.activityModes).toEqual(activityModes);
    expect(network.resources).toEqual(selectedNetwork.resource_kinds.map((kind) => ({
      kind,
      url: privateOrganization.resources[kind],
    })));
    expect(selectedNetwork).not.toHaveProperty('source_url');
  });

  it('maps a private formation ID to its distinct public symposium identity', () => {
    const input = fixture();
    const privateId = 'private-ifi-formation-event';
    const publicId = 'public-ifi-formation-symposium';
    input.mutate(organizationPath, (catalog) => { organization(catalog).formation_event_id = privateId; });
    input.mutate(eventsPath, (catalog) => { formationEvent(catalog).event_id = privateId; });
    input.mutate(publicationPath, (manifest) => {
      const entry = formationPublication(manifest);
      entry.record_id = privateId;
      entry.public_id = publicId;
    });
    const records = input.plan();
    expect(records.ifiNetworks[0].formation).toEqual({ symposiumId: publicId });
    expect(records.ifiSymposiums.some((record) => record.id === publicId)).toBe(true);
    expect(JSON.stringify(records)).not.toContain(privateId);
    expect(ResearchRecordsSchema.safeParse(records).success).toBe(true);
  });

  it('selects resource URLs only from the organization and retains publication selection order', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      networkEntry(manifest).resource_kinds = ['texts', 'about'];
    });
    input.mutate(organizationPath, (catalog) => {
      const record = organization(catalog);
      record.url = 'https://example.org/ifi/';
      record.activity_modes = ['discussion', 'symposium', 'webinar', 'collective_reading'];
      record.resources.texts = 'https://example.org/approved-texts/';
      record.resources.about = 'http://example.org/approved-about/';
      record.resources.history = 'https://example.org/not-selected-history/';
      record.resources.internal_archive = 'https://example.org/not-selected-internal/';
    });
    const network = input.plan().ifiNetworks[0];
    expect(network.url).toBe('https://example.org/ifi/');
    expect(network.activityModes).toEqual(['discussion', 'symposium', 'webinar', 'collective_reading']);
    expect(network.resources).toEqual([
      { kind: 'texts', url: 'https://example.org/approved-texts/' },
      { kind: 'about', url: 'http://example.org/approved-about/' },
    ]);
    expect(JSON.stringify(network)).not.toContain('not-selected');
    expect(network.resources.every((resource) => Object.keys(resource).sort().join(',') === 'kind,url')).toBe(true);
  });

  it('does not publish private organization facts or duplicate formation details', () => {
    const input = fixture();
    input.mutate(organizationPath, (catalog) => {
      Object.assign(organization(catalog), {
        positioning_en: 'PRIVATE_POSITIONING_SENTINEL',
        founded: 1901,
        members: ['PRIVATE_MEMBER_SENTINEL'],
        contacts: ['PRIVATE_CONTACT_SENTINEL'],
        internal_notes: 'PRIVATE_NOTES_SENTINEL',
        history_fulltext: 'PRIVATE_FULLTEXT_SENTINEL',
        attachments: ['PRIVATE_ATTACHMENT_SENTINEL'],
        statistics: { members: 999 },
      });
    });
    const network = input.plan().ifiNetworks[0];
    expect(Object.keys(network).sort()).toEqual([
      'abbreviation', 'activityModes', 'formation', 'id', 'name', 'resources', 'summary', 'title', 'url',
    ]);
    expect(network.formation).toEqual({ symposiumId: formationPublication(publication).public_id });
    expect(JSON.stringify(network)).not.toContain('PRIVATE_');
    for (const field of ['founded', 'positioning_en', 'formation_event_id', 'period', 'location', 'symposiums']) {
      expect(network).not.toHaveProperty(field);
    }
  });

  it('supports an explicit empty resource selection without publishing organization resources', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { networkEntry(manifest).resource_kinds = []; });
    const network = input.plan().ifiNetworks[0];
    expect(network.resources).toEqual([]);
    expect(IfiNetworkSchema.safeParse(network).success).toBe(true);
  });

  it('keeps all other research collections unchanged when only IFI organization facts change', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(organizationPath, (catalog) => {
      const record = organization(catalog);
      record.url = 'https://example.org/changed-ifi/';
      record.activity_modes.reverse();
      record.resources.about = 'https://example.org/changed-about/';
    });
    input.mutate(publicationPath, (manifest) => {
      networkEntry(manifest).resource_kinds = ['about'];
    });
    const after = input.plan();
    for (const collection of Object.keys(before).filter((key) => key !== 'ifiNetworks')) {
      expect(after[collection], collection).toEqual(before[collection]);
    }
  });

  it('builds the existing research page with its formation year and all four selected symposiums', () => {
    const records = readJson(projectRoot, '.website-input/research-records.json');
    const html = readFileSync(builtRoutePath('/research/'), 'utf8');
    const ifi = html.match(/<section[^>]+aria-labelledby="ifi-heading"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    expect(ifi).toBeDefined();
    const network = records.ifiNetworks[0];
    const formation = records.ifiSymposiums.find((record) => record.id === network.formation.symposiumId);
    expect(ifi).toContain(`其国际网络形成于 ${formation.period.start.slice(0, 4)} 年`);
    expect(ifi).not.toContain('成立于');
    expect(records.ifiSymposiums).toHaveLength(4);
    expect([...ifi.matchAll(/<h3\b/g)]).toHaveLength(records.ifiSymposiums.length);
    for (const symposium of records.ifiSymposiums) {
      expect(ifi).toContain(symposium.title);
      expect(ifi).toContain(symposium.location);
      for (const source of symposium.sources) expect(ifi).toContain(`href="${source.url}"`);
    }
    // Some selected resources are already symposium source links; the page keeps
    // those references, without adding a new resource navigation block.
    const existingUrls = new Set([network.url, ...records.ifiSymposiums.flatMap((symposium) => (
      symposium.sources.map((source) => source.url)
    ))]);
    for (const resource of network.resources.filter((record) => !existingUrls.has(record.url))) {
      expect(ifi).not.toContain(`href="${resource.url}"`);
    }
    expect([...ifi.matchAll(/<a\b/g)]).toHaveLength(1 + records.ifiSymposiums.reduce((total, symposium) => (
      total + symposium.sources.length
    ), 0));
    expect(pageFileExists('research/ifi/index.astro')).toBe(false);
    expect(pageFileExists('research/ifi.astro')).toBe(false);
    expect(html).not.toContain('<script');
    for (const heading of ['researchers-heading', 'research-sites-heading', 'readings-heading']) {
      expect(html).toContain(`id="${heading}"`);
    }
  });

  it.each([
    ['missing formation event', eventsPath, (catalog) => {
      catalog.activity_groups = catalog.activity_groups.filter((event) => event.event_id !== privateOrganization.formation_event_id);
    }],
    ['another organization', eventsPath, (catalog) => { catalog.organization_id = 'org-other'; }],
    ['ambiguous private event', eventsPath, (catalog) => {
      catalog.activity_groups.push({ ...formationEvent(catalog) });
    }],
    ['unsupported activity type', eventsPath, (catalog) => { formationEvent(catalog).type = 'webinar_series'; }],
    ['unconfirmed symposium', eventsPath, (catalog) => { formationEvent(catalog).event_status = 'planned'; }],
    ['unpublished formation event', publicationPath, (manifest) => {
      formationPublication(manifest).publication_scope = 'private_research';
    }],
    ['another publication kind', publicationPath, (manifest) => {
      formationPublication(manifest).kind = 'ilyenkov_readings';
    }],
    ['multiple formation publications', publicationPath, (manifest) => {
      manifest.records.push({ ...formationPublication(manifest), public_id: 'second-public-formation-symposium' });
    }],
    ['publication at another record path', publicationPath, (manifest) => {
      formationPublication(manifest).record_path = 'research/another/events.json';
    }],
  ])('rejects a formation relation with %s', (_name, relative, mutate) => {
    const input = fixture();
    input.mutate(relative, mutate);
    expect(() => input.plan()).toThrow(/formation|confirmed symposium|org-ifi/i);
  });

  it.each(['workshop', 'panel', 'frequency'])('rejects the unsupported activity mode %s', (mode) => {
    const input = fixture();
    input.mutate(organizationPath, (catalog) => { organization(catalog).activity_modes.push(mode); });
    expect(() => input.plan()).toThrow(/activity_modes|activity mode/i);
  });

  it.each(['', 'not a URL', 'ftp://example.org/ifi', 'file:///private/organization'])('rejects the invalid organization URL %j', (url) => {
    const input = fixture();
    input.mutate(organizationPath, (catalog) => { organization(catalog).url = url; });
    expect(() => input.plan()).toThrow(/url|public http\(s\)/i);
  });

  it.each(['source_url', 'url', 'resources'])('rejects publication %s instead of allowing a URL override', (field) => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      networkEntry(manifest)[field] = field === 'resources'
        ? { about: 'https://example.org/publication-override/' }
        : 'https://example.org/publication-override/';
    });
    expect(() => input.plan()).toThrow(/unsupported IFI network publication field/i);
  });

  it.each([
    ['unknown resource kind', publicationPath, (manifest) => { networkEntry(manifest).resource_kinds.push('webinars'); }],
    ['duplicate resource kind', publicationPath, (manifest) => { networkEntry(manifest).resource_kinds.push('about'); }],
    ['missing selected resource', organizationPath, (catalog) => { delete organization(catalog).resources.about; }],
    ['invalid selected resource URL', organizationPath, (catalog) => { organization(catalog).resources.about = 'ftp://example.org/about'; }],
    ['empty selected resource URL', organizationPath, (catalog) => { organization(catalog).resources.about = ''; }],
    ['missing resource selection', publicationPath, (manifest) => { delete networkEntry(manifest).resource_kinds; }],
  ])('rejects %s', (_name, relative, mutate) => {
    const input = fixture();
    input.mutate(relative, mutate);
    expect(() => input.plan()).toThrow(/resource|url|public http\(s\)/i);
  });
});

describe('strict public IFI schemas', () => {
  it('accepts the selected official resource kinds and activity modes', () => {
    const network = fixture().plan().ifiNetworks[0];
    expect(IfiNetworkSchema.safeParse(network).success).toBe(true);
    expect(network.resources.map((resource) => resource.kind)).toEqual(resourceKinds);
    expect(network.activityModes).toEqual(activityModes);
  });

  it.each([
    ['private formation identity', (record) => { record.formation = { event_id: 'private-id' }; }],
    ['invalid public ID', (record) => { record.formation.symposiumId = '../private-id'; }],
    ['duplicated formation year', (record) => { record.formation.year = '2012'; }],
    ['founded', (record) => { record.founded = '2012'; }],
    ['positioning_en', (record) => { record.positioning_en = 'private text'; }],
    ['unknown activity mode', (record) => { record.activityModes.push('workshop'); }],
    ['unknown resource kind', (record) => { record.resources[0].kind = 'webinars'; }],
    ['duplicate public resource kind', (record) => { record.resources.push({ ...record.resources[0] }); }],
    ['invalid resource URL', (record) => { record.resources[0].url = 'file:///private/about'; }],
    ['resource presentation metadata', (record) => { record.resources[0].label = 'About'; }],
  ])('rejects %s from the public network', (_name, mutate) => {
    const network = fixture().plan().ifiNetworks[0];
    mutate(network);
    expect(IfiNetworkSchema.safeParse(network).success).toBe(false);
  });

  it('requires the formation public ID to resolve exactly once in the independent symposium collection', () => {
    const records = fixture().plan();
    expect(ResearchRecordsSchema.safeParse(records).success).toBe(true);
    const formationId = records.ifiNetworks[0].formation.symposiumId;
    const missing = structuredClone(records);
    missing.ifiSymposiums = missing.ifiSymposiums.filter((record) => record.id !== formationId);
    expect(ResearchRecordsSchema.safeParse(missing).success).toBe(false);
    const duplicate = structuredClone(records);
    duplicate.ifiSymposiums.push(structuredClone(records.ifiSymposiums.find((record) => record.id === formationId)));
    expect(ResearchRecordsSchema.safeParse(duplicate).success).toBe(false);
  });
});
