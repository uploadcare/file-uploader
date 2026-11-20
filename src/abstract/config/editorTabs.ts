/** The image editor's tabs; `cloudImageEditorTabs` lists these. */
export const TabId = Object.freeze({
  CROP: 'crop',
  TUNING: 'tuning',
  FILTERS: 'filters',
} as const);

export type TabIdValue = (typeof TabId)[keyof typeof TabId];

export const ALL_TABS = Object.freeze([TabId.CROP, TabId.TUNING, TabId.FILTERS] as const);
