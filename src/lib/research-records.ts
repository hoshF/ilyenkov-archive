import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { buildCache } from './cache';
import {
  portraitFilePattern,
  ActivitySchema,
  BiographySchema,
  CongressSchema,
  WorkSchema,
  ReadingsSchema,
  ReadingsSeriesSchema,
  IfiNetworkSchema,
  IfiSymposiumSchema,
  ResearcherSchema,
  ResearchSiteSchema,
  IlyenkovProfileSchema,
  ResearchRecordsSchema,
} from './research-record.mjs';

export {
  IfiEditorialSchema,
  ReadingsEditorialSchema,
  ReadingsSeriesSchema,
  IfiNetworkSchema,
  ResearcherSchema,
  TimelineSchema,
  WorksCatalogSchema,
  LifeSchema,
  CircleSchema,
  IlyenkovProfileSchema,
  ResearchRecordsSchema,
} from './research-record.mjs';

const projectRoot = process.cwd();
const recordsPath = path.join(projectRoot, '.website-input', 'research-records.json');
const portraitsRoot = path.join(projectRoot, '.website-input', 'portraits');

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
export type PublicIlyenkovProfile = z.infer<typeof IlyenkovProfileSchema>;
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

/** 人物照片在生成输入中的文件；文件名来自已校验的 researcher 或伊里因科夫记录。 */
export function resolvePortraitPath(portrait: string): string {
  if (!portraitFilePattern.test(portrait)) throw new Error(`Invalid portrait: ${portrait}`);
  return path.join(portraitsRoot, portrait);
}

export function getPublicResearchSites(): PublicResearchSite[] {
  return [...getPublicResearchRecords().researchSites];
}

export function formatHistoricalPeriod({ start, end }: PublicActivity['period']): string {
  const format = (value: string) => value.replaceAll('-', '.');
  if (start === end) return format(start);
  const [startYear, startMonth, startDay] = start.split('-');
  const [endYear, endMonth, endDay] = end.split('-');
  if (startYear === endYear && startMonth === endMonth && startDay && endDay) {
    return `${format(start)}–${endDay}`;
  }
  if (startYear === endYear && startMonth && endMonth && Boolean(startDay) === Boolean(endDay)) {
    return `${format(start)}–${end.slice(5).replaceAll('-', '.')}`;
  }
  return `${format(start)}–${format(end)}`;
}

export function getPublicIlyenkov() {
  const profile = getPublicResearchRecords().ilyenkov;
  if (!profile) throw new Error('Public Ilyenkov profile is missing');
  return profile;
}
