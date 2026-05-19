import type { ConfigType, CustomConfig } from '../types';

export const sharedConfigKey = <T extends keyof (ConfigType & CustomConfig)>(key: T): `*cfg/${T}` => `*cfg/${key}`;
