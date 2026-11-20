import { FILTER_NAMES } from '@uploadcare/cdn-url/ops';
import { describe, expect, it } from 'vitest';
import { EDITOR_DEFAULT_LOCALE } from './editor-locale';
import { ALL_FILTERS } from './toolbar-constants';

describe('ALL_FILTERS', () => {
  it('is the CDN filter list, not a local copy of it', () => {
    expect(ALL_FILTERS).toBe(FILTER_NAMES);
  });

  /**
   * Sourcing the list from `@uploadcare/cdn-url` trades a stale-list risk for a
   * missing-label one: a preset added upstream would render in the toolbar with
   * no name. This fails the moment that happens, naming the offenders.
   */
  it('has a display label for every filter the CDN offers', () => {
    const unlabelled = ALL_FILTERS.filter((filter) => !EDITOR_DEFAULT_LOCALE[filter]);

    expect(unlabelled).toEqual([]);
  });
});
