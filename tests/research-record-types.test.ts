import { expectTypeOf, it } from 'vitest';
import type { PublicResearchRecords as Records } from '../src/lib/research-records';

it('preserves literal unions inferred from the shared JavaScript schemas', () => {
  expectTypeOf<NonNullable<Records['readingsSeries']>[number]['type']>().toEqualTypeOf<'academic_conference_series'>();
  expectTypeOf<NonNullable<Records['readingsSeries']>[number]['resources'][number]['kind']>()
    .toEqualTypeOf<'archive' | 'society' | 'historical_archive'>();
  expectTypeOf<Records['ifiNetworks'][number]['activityModes'][number]>()
    .toEqualTypeOf<'symposium' | 'webinar' | 'collective_reading' | 'discussion'>();
  expectTypeOf<Records['ifiNetworks'][number]['resources'][number]['kind']>()
    .toEqualTypeOf<'about' | 'history' | 'texts' | 'symposiums' | 'youtube' | 'facebook'>();
  expectTypeOf<Records['ifiSymposiums'][number]['status']>().toEqualTypeOf<'confirmed' | 'planned'>();
  expectTypeOf<Records['ifiSymposiums'][number]['format']>().toEqualTypeOf<'in_person' | 'online' | 'hybrid'>();
  expectTypeOf<Records['researchers'][number]['resources'][number]['kind']>().toEqualTypeOf<'personal' | 'orcid' | 'institution'>();
  expectTypeOf<Records['life']['stages'][number]['links'][number]['target']>().toEqualTypeOf<'timeline' | 'circle' | 'works'>();
  expectTypeOf<Records['circle']['sections'][number]['recordKind']>().toEqualTypeOf<'biography_event' | 'military_service' | 'hegel_congress'>();
  expectTypeOf<NonNullable<NonNullable<Records['ilyenkov']>['resources']>[number]['kind']>().toEqualTypeOf<'wikipedia_zh'>();
  expectTypeOf<NonNullable<Records['ilyenkov']>['entrances'][number]['target']>().toEqualTypeOf<'life' | 'timeline' | 'works' | 'circle'>();
});
