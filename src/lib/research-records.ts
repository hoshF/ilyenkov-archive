import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { buildCache } from './cache';

const projectRoot = process.cwd();
const recordsPath = path.join(projectRoot, '.website-input', 'research-records.json');

const PublicUrlSchema = z.string().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}, 'Invalid public URL');

const SourceSchema = z.object({
  title: z.string().trim().min(1),
  creator: z.string().trim().min(1).nullable(),
  url: PublicUrlSchema,
}).strict();

const PeriodSchema = z.object({
  start: z.string().regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/),
  end: z.string().regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/),
}).strict();

const ActivitySchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  period: PeriodSchema,
  sources: z.array(SourceSchema).min(1),
}).strict();

const BiographySchema = ActivitySchema.extend({
  location: z.string().trim().min(1).nullable(),
}).strict();

const CongressSchema = ActivitySchema.extend({
  status: z.string().trim().min(1),
  location: z.string().trim().min(1),
}).strict();

const WorkSourceSchema = z.object({
  label: z.string().trim().min(1),
  title: z.string().trim().min(1),
  url: PublicUrlSchema,
}).strict();

const WorkSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  originalTitle: z.string().trim().min(1),
  year: z.string().regex(/^\d{4}$/),
  type: z.string().trim().min(1),
  sources: z.array(WorkSourceSchema).min(1),
}).strict();

const ReadingsSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  edition: z.string().trim().min(1),
  title: z.string().trim().min(1),
  location: z.string().trim().min(1).nullable(),
  format: z.string().trim().min(1).nullable(),
  period: PeriodSchema,
  sources: z.array(SourceSchema).min(1),
}).strict().refine((record) => Boolean(record.location) !== Boolean(record.format), {
  message: 'A reading must have either a location or an activity format',
});

export const IfiEditorialSchema = z.object({
  introduction: z.array(z.string().trim().min(1)).min(1),
  symposiumsLead: z.string().trim().min(1).refine((value) => !/[\r\n]/.test(value), {
    message: 'Editorial lead must be one line',
  }),
}).strict();

export const ReadingsEditorialSchema = z.object({
  introduction: z.array(z.string().trim().min(1)).min(1),
}).strict();

export const ReadingsSeriesSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  name: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  type: z.literal('academic_conference_series'),
  editorial: ReadingsEditorialSchema.optional(),
  history: z.object({
    earliestArchivedEventId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    firstInternationalEventId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }).strict(),
  resources: z.array(z.object({
    kind: z.enum(['archive', 'society', 'historical_archive']),
    url: PublicUrlSchema,
  }).strict()).refine((resources) => (
    new Set(resources.map((resource) => resource.kind)).size === resources.length
  ), { message: 'Readings series resources must have unique kinds' }),
}).strict();

export const IfiNetworkSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  name: z.string().trim().min(1),
  abbreviation: z.string().trim().min(1),
  editorial: IfiEditorialSchema.optional(),
  formation: z.object({
    symposiumId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }).strict(),
  activityModes: z.array(z.enum([
    'symposium', 'webinar', 'collective_reading', 'discussion',
  ])),
  resources: z.array(z.object({
    kind: z.enum(['about', 'history', 'texts', 'symposiums', 'youtube', 'facebook']),
    url: PublicUrlSchema,
  }).strict()).refine((resources) => (
    new Set(resources.map((resource) => resource.kind)).size === resources.length
  ), { message: 'IFI resources must have unique kinds' }),
  summary: z.string().trim().min(1),
  url: PublicUrlSchema,
}).strict();

const IfiSymposiumSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  context: z.string().trim().min(1),
  location: z.string().trim().min(1),
  period: PeriodSchema,
  sources: z.array(SourceSchema).min(1),
}).strict();

const ResearcherEditorialSchema = z.object({
  introduction: z.array(z.string().trim().min(1)).min(1),
  workDescription: z.string().trim().min(1).regex(/^[^\r\n]+$/),
}).strict();

export const ResearcherSchema = z.object({
  editorial: ResearcherEditorialSchema.optional(),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  personId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  originalName: z.string().trim().min(1),
  latinName: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1),
  roles: z.array(z.string().trim().min(1)).min(1).optional(),
  researchFields: z.array(z.string().trim().min(1)).min(1).optional(),
  resources: z.array(z.object({
    kind: z.enum(['personal', 'orcid', 'institution']),
    url: PublicUrlSchema,
  }).strict()).refine((resources) => (
    new Set(resources.map((resource) => resource.kind)).size === resources.length
  ), { message: 'Researcher resources must have unique kinds' }),
}).strict();

const ResearchSiteSectionSchema = z.object({
  label: z.string().trim().min(1),
  url: PublicUrlSchema,
}).strict();

const ResearchSiteSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  originalTitle: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  url: PublicUrlSchema,
  sections: z.array(ResearchSiteSectionSchema).min(1),
}).strict();

const EditorialLineSchema = z.string().trim().min(1).refine((value) => !/[\r\n]/.test(value), {
  message: 'Editorial text must be one line',
});

export const TimelineSchema = z.object({
  recordIds: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).refine((ids) => (
    new Set(ids).size === ids.length
  ), { message: 'Timeline references must be unique' }),
  editorial: z.object({ description: EditorialLineSchema }).strict(),
}).strict();

export const WorksCatalogSchema = z.object({
  editorial: z.object({
    description: EditorialLineSchema,
    lead: EditorialLineSchema,
    note: EditorialLineSchema,
    typeNotes: z.record(z.string().trim().min(1), EditorialLineSchema),
  }).strict(),
}).strict();

const PageReferencesSchema = z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).refine((ids) => (
  new Set(ids).size === ids.length
), { message: 'Page references must be unique' });

export const LifeSchema = z.object({
  description: EditorialLineSchema,
  lead: EditorialLineSchema,
  note: EditorialLineSchema,
  stages: z.array(z.object({
    title: EditorialLineSchema,
    recordIds: PageReferencesSchema,
    summary: EditorialLineSchema.optional(),
    period: PeriodSchema.optional(),
    years: z.array(z.string().regex(/^\d{4}$/)).optional(),
    links: z.array(z.object({
      target: z.enum(['timeline', 'circle', 'works']),
      label: EditorialLineSchema,
    }).strict()),
  }).strict()),
}).strict();

export const CircleSchema = z.object({
  description: EditorialLineSchema,
  sections: z.array(z.object({
    recordKind: z.enum(['biography_event', 'military_service', 'hegel_congress']),
    title: EditorialLineSchema,
    lead: EditorialLineSchema,
    recordIds: PageReferencesSchema,
  }).strict()).refine((sections) => (
    new Set(sections.map((section) => section.title)).size === sections.length
  ), { message: 'Circle sections must have unique titles' }).refine((sections) => {
    const ids = sections.flatMap((section) => section.recordIds);
    return new Set(ids).size === ids.length;
  }, { message: 'Circle references cannot repeat across sections' }),
}).strict();

export const IlyenkovProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  personId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  identity: EditorialLineSchema,
  originalName: EditorialLineSchema,
  lifespan: z.string().regex(/^\d{4}—\d{4}$/),
  summary: EditorialLineSchema,
  description: EditorialLineSchema,
  introduction: z.array(z.string().trim().min(1)).min(1),
  entrances: z.array(z.object({
    target: z.enum(['life', 'timeline', 'works', 'circle']),
    label: EditorialLineSchema,
    summary: EditorialLineSchema,
  }).strict()).refine((entrances) => new Set(entrances.map((entrance) => entrance.target)).size === entrances.length,
    { message: 'Ilyenkov entrance targets must be unique' }),
}).strict();

export const ResearchRecordsSchema = z.object({
  ilyenkov: IlyenkovProfileSchema.optional(),
  biography: z.array(BiographySchema).min(1),
  military: z.array(ActivitySchema).min(1),
  congresses: z.array(CongressSchema).min(1),
  works: z.array(WorkSchema).min(1),
  readings: z.array(ReadingsSchema).min(1),
  readingsSeries: z.array(ReadingsSeriesSchema).min(1).optional(),
  ifiNetworks: z.array(IfiNetworkSchema).min(1),
  ifiSymposiums: z.array(IfiSymposiumSchema).min(1),
  researchers: z.array(ResearcherSchema).min(1),
  researchSites: z.array(ResearchSiteSchema).min(1),
  timeline: TimelineSchema,
  worksCatalog: WorksCatalogSchema,
  life: LifeSchema,
  circle: CircleSchema,
}).strict().superRefine((records, context) => {
  const activityRecords = [...records.biography, ...records.military, ...records.congresses];
  records.timeline.recordIds.forEach((id, index) => {
    if (activityRecords.filter((record) => record.id === id).length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['timeline', 'recordIds', index],
        message: 'Timeline must reference exactly one public activity record',
      });
    }
  });
  records.life.stages.forEach((stage, index) => {
    const issue = (message: string) => context.addIssue({
      code: 'custom', path: ['life', 'stages', index], message,
    });
    const selectedActivities = activityRecords.filter((record) => stage.recordIds.includes(record.id));
    const selectedWorks = records.works.filter((work) => stage.recordIds.includes(work.id));
    for (const id of stage.recordIds) {
      if ([...selectedActivities, ...selectedWorks].filter((record) => record.id === id).length !== 1) {
        issue('Life must reference exactly one public activity or work record');
      }
    }
    if (selectedWorks.length && selectedActivities.length) issue('Life work and activity references cannot be mixed');
    if (selectedWorks.length && !stage.summary) issue('Life work references require an editorial summary');
    if (stage.recordIds.length === 0) {
      if (stage.period || stage.years) issue('Empty life references cannot have derived coordinates');
    } else if (selectedWorks.length) {
      const years = [...new Set(selectedWorks.map((work) => work.year))].sort();
      if (stage.period || JSON.stringify(stage.years) !== JSON.stringify(years)) {
        issue('Life years must derive from the selected public works');
      }
    } else if (selectedActivities.length) {
      const start = selectedActivities.map((record) => record.period.start).sort()[0];
      const end = selectedActivities.map((record) => record.period.end).sort().at(-1);
      if (stage.years || stage.period?.start !== start || stage.period?.end !== end) {
        issue('Life period must derive from the selected public activities');
      }
    }
  });
  records.circle.sections.forEach((section, index) => {
    const available = {
      biography_event: records.biography,
      military_service: records.military,
      hegel_congress: records.congresses,
    }[section.recordKind];
    section.recordIds.forEach((id, referenceIndex) => {
      if (available.filter((record) => record.id === id).length !== 1) {
        context.addIssue({
          code: 'custom', path: ['circle', 'sections', index, 'recordIds', referenceIndex],
          message: 'Circle must reference exactly one public record of its section kind',
        });
      }
    });
  });
  const workTypes = new Set(records.works.map((work) => work.type));
  for (const type of Object.keys(records.worksCatalog.editorial.typeNotes)) {
    if (!workTypes.has(type)) {
      context.addIssue({
        code: 'custom',
        path: ['worksCatalog', 'editorial', 'typeNotes', type],
        message: 'Catalog note must reference a public work type',
      });
    }
  }
  records.readingsSeries?.forEach((series, index) => {
    for (const relation of ['earliestArchivedEventId', 'firstInternationalEventId'] as const) {
      const matchingReadings = records.readings.filter((record) => (
        record.id === series.history[relation]
      ));
      if (matchingReadings.length !== 1) {
        context.addIssue({
          code: 'custom',
          path: ['readingsSeries', index, 'history', relation],
          message: 'Readings series history must reference exactly one public reading',
        });
      }
    }
  });
  records.ifiNetworks.forEach((network, index) => {
    const matchingSymposiums = records.ifiSymposiums.filter((symposium) => (
      symposium.id === network.formation.symposiumId
    ));
    if (matchingSymposiums.length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['ifiNetworks', index, 'formation', 'symposiumId'],
        message: 'IFI formation must reference exactly one public symposium',
      });
    }
  });
});

export type PublicActivity = z.infer<typeof ActivitySchema>;
export type PublicBiographyEvent = z.infer<typeof BiographySchema>;
export type PublicCongress = z.infer<typeof CongressSchema>;
export type PublicResearchRecords = z.infer<typeof ResearchRecordsSchema>;
export type PublicWork = z.infer<typeof WorkSchema>;
export type PublicReadings = z.infer<typeof ReadingsSchema>;
export type PublicReadingsSeries = z.infer<typeof ReadingsSeriesSchema>;
export type PublicIfiNetwork = z.infer<typeof IfiNetworkSchema>;
export type PublicIfiSymposium = z.infer<typeof IfiSymposiumSchema>;
export type PublicResearcher = z.infer<typeof ResearcherSchema>;
export type PublicResearchSite = z.infer<typeof ResearchSiteSchema>;
export type PublicTimelineRecord = PublicActivity & {
  category: 'biography' | 'military' | 'congress';
  categoryLabel: string;
  location: string | null;
  status: string | null;
};

export const getPublicResearchRecords = buildCache((): PublicResearchRecords => (
  ResearchRecordsSchema.parse(JSON.parse(readFileSync(recordsPath, 'utf8')))
));

export function getPublicLife() {
  const records = getPublicResearchRecords();
  const activityById = new Map([
    ...records.biography, ...records.military, ...records.congresses,
  ].map((record) => [record.id, record]));
  return {
    ...records.life,
    stages: records.life.stages.map((stage) => ({
      ...stage,
      summary: stage.summary ?? stage.recordIds.map((id) => activityById.get(id)!.summary).join(''),
    })),
  };
}

export function getPublicCircle() {
  const records = getPublicResearchRecords();
  const collections = {
    biography_event: records.biography.map((record) => ({ ...record, status: null })),
    military_service: records.military.map((record) => ({ ...record, location: null, status: null })),
    hegel_congress: records.congresses,
  };
  return {
    ...records.circle,
    sections: records.circle.sections.map((section) => {
      const available = collections[section.recordKind];
      const byId = new Map(available.map((record) => [record.id, record]));
      return {
        ...section,
        records: section.recordIds.map((id) => byId.get(id)!).sort((left, right) => (
          left.period.start.localeCompare(right.period.start)
            || left.period.end.localeCompare(right.period.end)
            || left.title.localeCompare(right.title, 'zh-Hans-CN')
        )),
      };
    }),
  };
}

export function getPublicTimelineEditorial() {
  return getPublicResearchRecords().timeline.editorial;
}

export function getPublicWorksEditorial() {
  return getPublicResearchRecords().worksCatalog.editorial;
}

export function getPublicTimelineRecords(): PublicTimelineRecord[] {
  const { biography, military, congresses, timeline } = getPublicResearchRecords();
  const byId = new Map([
    ...biography.map((record) => ({
      ...record,
      category: 'biography' as const,
      categoryLabel: '生平坐标',
      status: null,
    })),
    ...military.map((record) => ({
      ...record,
      category: 'military' as const,
      categoryLabel: '服役经历',
      location: null,
      status: null,
    })),
    ...congresses.map((record) => ({
      ...record,
      category: 'congress' as const,
      categoryLabel: '国际黑格尔大会',
    })),
  ].map((record) => [record.id, record] as const));
  return timeline.recordIds.map((id) => byId.get(id)!).sort((left, right) => (
    left.period.start.localeCompare(right.period.start)
      || left.period.end.localeCompare(right.period.end)
      || left.title.localeCompare(right.title, 'zh-Hans-CN')
  ));
}

export function getPublicBiographyRecords(): PublicBiographyEvent[] {
  return [...getPublicResearchRecords().biography].sort((left, right) => (
    left.period.start.localeCompare(right.period.start)
      || left.period.end.localeCompare(right.period.end)
      || left.title.localeCompare(right.title, 'zh-Hans-CN')
  ));
}

export function getPublicWorks(): PublicWork[] {
  return [...getPublicResearchRecords().works].sort((left, right) => (
    left.type.localeCompare(right.type, 'zh-Hans-CN')
      || left.year.localeCompare(right.year)
      || left.title.localeCompare(right.title, 'zh-Hans-CN')
  ));
}

export function getPublicReadings(): PublicReadings[] {
  return [...getPublicResearchRecords().readings].sort((left, right) => (
    left.period.start.localeCompare(right.period.start)
  ));
}

export function getPublicReadingsSeries(): PublicReadingsSeries[] {
  return [...(getPublicResearchRecords().readingsSeries ?? [])];
}

export function getPublicIfiNetwork(): PublicIfiNetwork {
  const networks = getPublicResearchRecords().ifiNetworks;
  if (networks.length !== 1) throw new Error('Expected exactly one public IFI network');
  return networks[0];
}

export function getPublicIfiSymposiums(): PublicIfiSymposium[] {
  return [...getPublicResearchRecords().ifiSymposiums].sort((left, right) => (
    left.period.start.localeCompare(right.period.start)
  ));
}

export function getPublicResearchers(): PublicResearcher[] {
  return [...getPublicResearchRecords().researchers];
}

export function getPublicResearchSites(): PublicResearchSite[] {
  return [...getPublicResearchRecords().researchSites];
}

export function formatHistoricalPeriod({ start, end }: PublicActivity['period']): string {
  const format = (value: string) => {
    const [year, month, day] = value.split('-');
    if (!month) return `${year} 年`;
    if (!day) return `${year} 年${Number(month)} 月`;
    return `${year} 年${Number(month)} 月${Number(day)} 日`;
  };
  return start === end ? format(start) : `${format(start)}—${format(end)}`;
}


export function getPublicIlyenkov() {
  const profile = getPublicResearchRecords().ilyenkov;
  if (!profile) throw new Error('Public Ilyenkov profile is missing');
  return profile;
}
