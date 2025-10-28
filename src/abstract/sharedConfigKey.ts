import type { ConfigType } from '../types';

export const sharedConfigKey = <T extends keyof ConfigType>(key: T): `*cfg/${T}` => `*cfg/${key}`;
