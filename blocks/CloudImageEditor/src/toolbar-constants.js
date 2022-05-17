import { OPERATIONS_ZEROS } from './lib/transformationUtils.js';

/** @type {{ CROP: 'crop'; SLIDERS: 'sliders'; FILTERS: 'filters' }} */
export const TabId = {
  CROP: 'crop',
  SLIDERS: 'sliders',
  FILTERS: 'filters',
};
export const TABS = [TabId.CROP, TabId.SLIDERS, TabId.FILTERS];

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
export const COLOR_OPERATIONS_CONFIG = {
  brightness: {
    zero: OPERATIONS_ZEROS.brightness,
    range: [-100, 100],
    keypointsNumber: 2,
  },
  exposure: {
    zero: OPERATIONS_ZEROS.exposure,
    range: [-500, 500],
    keypointsNumber: 2,
  },
  gamma: {
    zero: OPERATIONS_ZEROS.gamma,
    range: [0, 1000],
    keypointsNumber: 2,
  },
  contrast: {
    zero: OPERATIONS_ZEROS.contrast,
    range: [-100, 500],
    keypointsNumber: 2,
  },
  saturation: {
    zero: OPERATIONS_ZEROS.saturation,
    range: [-100, 500],
    keypointsNumber: 1,
  },
  vibrance: {
    zero: OPERATIONS_ZEROS.vibrance,
    range: [-100, 500],
    keypointsNumber: 1,
  },
  warmth: {
    zero: OPERATIONS_ZEROS.warmth,
    range: [-100, 100],
    keypointsNumber: 1,
  },
  enhance: {
    zero: OPERATIONS_ZEROS.enhance,
    range: [0, 100],
    keypointsNumber: 1,
  },
  filter: {
    zero: OPERATIONS_ZEROS.filter,
    range: [0, 100],
    keypointsNumber: 1,
  },
};
