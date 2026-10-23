import { getPublicReadingsSeries, type PublicReadingsSeries } from './research-records';

/** 当前 Readings 栏目的公开身份；集合中的其他系列不影响此页面依赖。 */
export function getReadingsPageSeries(): PublicReadingsSeries {
  const series = getPublicReadingsSeries().find((record) => record.id === 'ilyenkov-readings-series');
  if (!series) throw new Error('Public Readings series ilyenkov-readings-series is missing');
  return series;
}
