import { getPluralForm } from './getPluralForm';

const BASE = 1000;

export const ByteUnitEnum = Object.freeze({
  AUTO: 'auto',
  BYTE: 'byte',
  KB: 'kb',
  MB: 'mb',
  GB: 'gb',
  TB: 'tb',
  PB: 'pb',
} as const);

export type ByteUnit = (typeof ByteUnitEnum)[keyof typeof ByteUnitEnum];

const round = (number: number): number => Math.ceil(number * 100) / 100;

export const prettyBytes = (bytes: number, unit: ByteUnit = ByteUnitEnum.AUTO): string => {
  const isAutoMode = unit === ByteUnitEnum.AUTO;

  if (unit === ByteUnitEnum.BYTE || (isAutoMode && bytes < BASE ** 1)) {
    const pluralForm = getPluralForm('en-US', bytes);
    const pluralized = pluralForm === 'one' ? 'byte' : 'bytes';

    return `${bytes} ${pluralized}`;
  }

  if (unit === ByteUnitEnum.KB || (isAutoMode && bytes < BASE ** 2)) {
    return `${round(bytes / BASE ** 1)} KB`;
  }

  if (unit === ByteUnitEnum.MB || (isAutoMode && bytes < BASE ** 3)) {
    return `${round(bytes / BASE ** 2)} MB`;
  }

  if (unit === ByteUnitEnum.GB || (isAutoMode && bytes < BASE ** 4)) {
    return `${round(bytes / BASE ** 3)} GB`;
  }

  if (unit === ByteUnitEnum.TB || (isAutoMode && bytes < BASE ** 5)) {
    return `${round(bytes / BASE ** 4)} TB`;
  }

  return `${round(bytes / BASE ** 5)} PB`;
};
