import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { plannedResearchOutputs } from '../scripts/lib/research-sync/planner.mjs';
import { getPublicResearchers, ResearchRecordsSchema } from '../src/lib/research-records';
import { researchRoot } from './helpers/publication';

const readJson = (relative) => JSON.parse(readFileSync(path.join(researchRoot, relative), 'utf8'));
let selections;
let people;
let output;

// This suite requires the real authorized sources. Missing sources fail explicitly; nothing is skipped.
beforeAll(() => {
  if (!existsSync(path.join(researchRoot, 'web/publication.json'))) {
    throw new Error(`Researcher publication integration unavailable: authorized private sources are required at ${researchRoot}`);
  }
  selections = readJson('web/publication.json').records.filter((entry) => (
    entry.publication_scope === 'website_public' && entry.kind === 'researcher_profile'
  ));
  people = readJson('people/persons.json').records;
  output = plannedResearchOutputs({ projectRoot: process.cwd(), researchRoot });
});

describe('researcher publication integration with authorized private sources', () => {
  it('projects every current selection from its actual canonical person and selected manuscript', () => {
    expect(selections.length).toBeGreaterThan(0);
    expect(ResearchRecordsSchema.safeParse(output.records).success).toBe(true);
    expect(output.records.researchers.map((record) => record.id)).toEqual(selections.map((entry) => entry.public_id));
    for (const entry of selections) {
      const matches = people.filter((person) => person.person_id === entry.record_id);
      expect(matches).toHaveLength(1);
      const person = matches[0];
      const portrait = entry.portrait_path
        ? `${entry.public_id}.${path.extname(entry.portrait_path).slice(1).toLowerCase().replace(/^jpeg$/, 'jpg')}` : undefined;
      expect(output.records.researchers.find((record) => record.id === entry.public_id)).toEqual({
        id: entry.public_id, personId: person.person_id, name: entry.title_zh,
        originalName: person.name_original, summary: entry.summary_zh,
        ...(Object.hasOwn(person, 'name_latin') ? { latinName: person.name_latin } : {}),
        ...(Object.hasOwn(person, 'roles') ? { roles: person.roles } : {}),
        ...(Object.hasOwn(person, 'research_fields') ? { researchFields: person.research_fields } : {}),
        resources: entry.resource_kinds.map((kind) => ({ kind, url: person.resources[kind] })),
        ...(entry.editorial_path ? { editorial: readJson(entry.editorial_path) } : {}),
        ...(portrait ? { portrait } : {}),
      });
    }
  });

  it('includes researcher portraits only when selected and preserves the authorized file bytes', () => {
    const researchers = output.records.researchers;
    for (const entry of selections) {
      const record = researchers.find((researcher) => researcher.id === entry.public_id);
      const files = [...output.portraits.keys()].filter((name) => name.startsWith(`${entry.public_id}.`));
      if (!entry.portrait_path) {
        expect(record).not.toHaveProperty('portrait');
        expect(files).toEqual([]);
      } else {
        expect(files).toEqual([record.portrait]);
        expect(readFileSync(output.portraits.get(record.portrait)))
          .toEqual(readFileSync(path.join(researchRoot, entry.portrait_path)));
      }
    }
  });

  it('keeps the current generated researcher input aligned with the actual authorized projection', () => {
    expect(getPublicResearchers()).toEqual(output.records.researchers);
  });
});
