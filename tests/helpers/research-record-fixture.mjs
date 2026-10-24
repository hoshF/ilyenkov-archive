/** Entirely fictional public output; no private files or publication selections. */
export function researchRecordFixture() {
  const source = { title: 'Synthetic evidence', creator: null, url: 'https://example.test/source' };
  const activity = (id, start, end = start) => ({
    id, title: 'Synthetic activity', summary: 'Synthetic summary', period: { start, end }, sources: [{ ...source }],
  });
  return {
    biography: [{ ...activity('synthetic-birth', '1900-01-01'), location: null }],
    military: [activity('synthetic-service', '1920', '1921')],
    congresses: [{ ...activity('synthetic-congress', '1930-02'), status: 'Confirmed', location: 'Synthetic city' }],
    works: [{ id: 'synthetic-work', title: 'Synthetic work', originalTitle: 'Synthetic original', year: '1940', type: 'Book',
      sources: [{ label: 'Synthetic catalog', title: 'Synthetic work evidence', url: 'https://example.test/work' }] }],
    readings: [{ id: 'synthetic-reading', edition: 'First', title: 'Synthetic reading', location: null, format: 'Online',
      period: { start: '2000', end: '2000' }, sources: [{ ...source }] }],
    readingsSeries: [{ id: 'synthetic-series', title: 'Synthetic series', name: 'Synthetic original series', summary: 'Synthetic summary',
      type: 'academic_conference_series', history: { earliestArchivedEventId: 'synthetic-reading', firstInternationalEventId: 'synthetic-reading' },
      resources: [{ kind: 'archive', url: 'https://example.test/archive' }], editorial: { introduction: ['Synthetic series introduction.'] } }],
    ifiNetworks: [{ id: 'synthetic-network', title: 'Synthetic network', name: 'Synthetic original network', abbreviation: 'SYN',
      summary: 'Synthetic summary', url: 'https://example.test/network', formation: { symposiumId: 'synthetic-symposium' },
      activityModes: ['symposium', 'webinar', 'collective_reading', 'discussion'], resources: [{ kind: 'about', url: 'https://example.test/about' }],
      editorial: { introduction: ['Synthetic network introduction.'], symposiumsLead: 'Synthetic lead.' } }],
    ifiSymposiums: [{ id: 'synthetic-symposium', title: 'Synthetic symposium', context: 'Synthetic context', status: 'confirmed', format: 'hybrid',
      location: 'Synthetic city', period: { start: '2001-01', end: '2001-02' }, sources: [{ ...source }] }],
    researchers: [{ id: 'synthetic-researcher', personId: 'synthetic-person', name: 'Synthetic researcher', originalName: 'Synthetic original name',
      latinName: 'Synthetic Latin name', summary: 'Synthetic summary', roles: ['Researcher'], researchFields: ['Synthetic field'],
      portrait: 'synthetic-researcher.jpg', resources: [{ kind: 'personal', url: 'https://example.test/person' }],
      editorial: { introduction: ['Synthetic introduction.'], workDescription: 'Synthetic work description.' } }],
    researchSites: [{ id: 'synthetic-site', title: 'Synthetic site', originalTitle: 'Synthetic original site', summary: 'Synthetic summary',
      url: 'https://example.test/site', sections: [{ label: 'Synthetic section', url: 'https://example.test/section' }] }],
    timeline: { recordIds: ['synthetic-birth', 'synthetic-service', 'synthetic-congress'], editorial: { description: 'Synthetic timeline.' } },
    worksCatalog: { editorial: { description: 'Synthetic catalog.', lead: 'Synthetic lead.', note: 'Synthetic note.', typeNotes: { Book: 'Synthetic type note.' } } },
    life: { description: 'Synthetic life.', lead: 'Synthetic lead.', note: 'Synthetic note.', stages: [
      { title: 'Synthetic activity stage', recordIds: ['synthetic-birth', 'synthetic-service'], period: { start: '1900-01-01', end: '1921' },
        links: [{ target: 'timeline', label: 'Synthetic timeline link' }] },
      { title: 'Synthetic work stage', recordIds: ['synthetic-work'], summary: 'Synthetic work summary.', years: ['1940'], links: [] },
    ] },
    circle: { description: 'Synthetic circle.', sections: [
      { recordKind: 'biography_event', title: 'Synthetic biography section', lead: 'Synthetic lead.', recordIds: ['synthetic-birth'] },
      { recordKind: 'military_service', title: 'Synthetic service section', lead: 'Synthetic lead.', recordIds: ['synthetic-service'] },
      { recordKind: 'hegel_congress', title: 'Synthetic congress section', lead: 'Synthetic lead.', recordIds: ['synthetic-congress'] },
    ] },
    ilyenkov: { id: 'synthetic-profile', personId: 'synthetic-profile-person', identity: 'Synthetic identity', originalName: 'Synthetic original name',
      lifespan: '1900—1980', resources: [{ kind: 'wikipedia_zh', url: 'https://example.test/profile' }], portrait: 'synthetic-profile.webp',
      portraitCredit: 'Synthetic credit.', summary: 'Synthetic summary.', description: 'Synthetic description.', introduction: ['Synthetic introduction.'],
      entrances: [{ target: 'life', label: 'Synthetic life link', summary: 'Synthetic entrance summary.' }] },
  };
}
