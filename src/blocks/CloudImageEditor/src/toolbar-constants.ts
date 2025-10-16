import { OPERATIONS_DEFAULTS } from './lib/transformationUtils.js';

export const TabId = Object.freeze({
  CROP: 'crop',
  TUNING: 'tuning',
  FILTERS: 'filters',
} as const);

export type TabIdValue = (typeof TabId)[keyof typeof TabId];

export const ALL_TABS = Object.freeze([TabId.CROP, TabId.TUNING, TabId.FILTERS] as const);

export const ALL_COLOR_OPERATIONS = Object.freeze([
  'brightness',
  'exposure',
  'gamma',
  'contrast',
  'saturation',
  'vibrance',
  'warmth',
  'enhance',
] as const);

export type ColorOperation = (typeof ALL_COLOR_OPERATIONS)[number];

export const ALL_FILTERS = Object.freeze([
  'adaris',
  'briaril',
  'calarel',
  'carris',
  'cynarel',
  'cyren',
  'elmet',
  'elonni',
  'enzana',
  'erydark',
  'fenralan',
  'ferand',
  'galen',
  'gavin',
  'gethriel',
  'iorill',
  'iothari',
  'iselva',
  'jadis',
  'lavra',
  'misiara',
  'namala',
  'nerion',
  'nethari',
  'pamaya',
  'sarnar',
  'sedis',
  'sewen',
  'sorahel',
  'sorlen',
  'tarian',
  'thellassan',
  'varriel',
  'varven',
  'vevera',
  'virkas',
  'yedis',
  'yllara',
  'zatvel',
  'zevcen',
] as const);

export type FilterId = (typeof ALL_FILTERS)[number];

export const ALL_CROP_OPERATIONS = Object.freeze(['rotate', 'mirror', 'flip'] as const);

export type CropOperation = (typeof ALL_CROP_OPERATIONS)[number];

type ColorOperationConfig = {
  zero: number;
  range: readonly [number, number];
  keypointsNumber: number;
};

type ColorOperationConfigKey = ColorOperation | 'filter';

const NUMERIC_OPERATION_DEFAULTS = OPERATIONS_DEFAULTS as Record<ColorOperationConfigKey, number>;

/** KeypointsNumber is the number of keypoints loaded from each side of zero, not total number */
export const COLOR_OPERATIONS_CONFIG = Object.freeze({
  brightness: {
    zero: NUMERIC_OPERATION_DEFAULTS.brightness,
    range: [-100, 100] as const,
    keypointsNumber: 2,
  },
  exposure: {
    zero: NUMERIC_OPERATION_DEFAULTS.exposure,
    range: [-500, 500] as const,
    keypointsNumber: 2,
  },
  gamma: {
    zero: NUMERIC_OPERATION_DEFAULTS.gamma,
    range: [0, 1000] as const,
    keypointsNumber: 2,
  },
  contrast: {
    zero: NUMERIC_OPERATION_DEFAULTS.contrast,
    range: [-100, 500] as const,
    keypointsNumber: 2,
  },
  saturation: {
    zero: NUMERIC_OPERATION_DEFAULTS.saturation,
    range: [-100, 500] as const,
    keypointsNumber: 1,
  },
  vibrance: {
    zero: NUMERIC_OPERATION_DEFAULTS.vibrance,
    range: [-100, 500] as const,
    keypointsNumber: 1,
  },
  warmth: {
    zero: NUMERIC_OPERATION_DEFAULTS.warmth,
    range: [-100, 100] as const,
    keypointsNumber: 1,
  },
  enhance: {
    zero: NUMERIC_OPERATION_DEFAULTS.enhance,
    range: [0, 100] as const,
    keypointsNumber: 1,
  },
  filter: {
    zero: NUMERIC_OPERATION_DEFAULTS.filter,
    range: [0, 100] as const,
    keypointsNumber: 1,
  },
} satisfies Record<ColorOperationConfigKey, ColorOperationConfig>);
