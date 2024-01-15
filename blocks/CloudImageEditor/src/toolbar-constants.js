// @ts-check
import { OPERATIONS_DEFAULTS } from './lib/transformationUtils.js';

export const TabId = Object.freeze({
  CROP: 'crop',
  TUNING: 'tuning',
  FILTERS: 'filters',
});
export const ALL_TABS = [TabId.CROP, TabId.TUNING, TabId.FILTERS];

export const ALL_COLOR_OPERATIONS = [
  'brightness',
  'exposure',
  'gamma',
  'contrast',
  'saturation',
  'vibrance',
  'warmth',
  'enhance',
];

export const ALL_FILTERS = [
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
];

export const ALL_CROP_OPERATIONS = ['rotate', 'mirror', 'flip'];

/** KeypointsNumber is the number of keypoints loaded from each side of zero, not total number */
export const COLOR_OPERATIONS_CONFIG = Object.freeze({
  brightness: {
    zero: OPERATIONS_DEFAULTS.brightness,
    range: [-100, 100],
    keypointsNumber: 2,
  },
  exposure: {
    zero: OPERATIONS_DEFAULTS.exposure,
    range: [-500, 500],
    keypointsNumber: 2,
  },
  gamma: {
    zero: OPERATIONS_DEFAULTS.gamma,
    range: [0, 1000],
    keypointsNumber: 2,
  },
  contrast: {
    zero: OPERATIONS_DEFAULTS.contrast,
    range: [-100, 500],
    keypointsNumber: 2,
  },
  saturation: {
    zero: OPERATIONS_DEFAULTS.saturation,
    range: [-100, 500],
    keypointsNumber: 1,
  },
  vibrance: {
    zero: OPERATIONS_DEFAULTS.vibrance,
    range: [-100, 500],
    keypointsNumber: 1,
  },
  warmth: {
    zero: OPERATIONS_DEFAULTS.warmth,
    range: [-100, 100],
    keypointsNumber: 1,
  },
  enhance: {
    zero: OPERATIONS_DEFAULTS.enhance,
    range: [0, 100],
    keypointsNumber: 1,
  },
  filter: {
    zero: OPERATIONS_DEFAULTS.filter,
    range: [0, 100],
    keypointsNumber: 1,
  },
});
