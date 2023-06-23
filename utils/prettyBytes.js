// @ts-check
import { getPluralForm } from './getPluralForm.js';

const BASE = 1000;

export const ByteUnitEnum = Object.freeze({
  AUTO: 'auto',
  BYTE: 'byte',
  KB: 'kb',
  MB: 'mb',
  GB: 'gb',
  TB: 'tb',
  PB: 'pb',
});

/**
 * Round a specified number to decimal with two places. Round to larger value, because basically we use it for usage and
 * we charge customers for 1 GB even he consumed 1 byte. Feature limits are usually specified in exact MB/GB/TB, so they
 * will not be rounded.
 *
 * @param {number} number
 * @returns {number}
 */
const round = (number) => Math.ceil(number * 100) / 100;

/**
 * @param {number} bytes
 * @param {(typeof ByteUnitEnum)[keyof typeof ByteUnitEnum]} unit
 * @returns {string}
 */
export const prettyBytes = (bytes, unit = ByteUnitEnum.AUTO) => {
  const isAutoMode = unit === ByteUnitEnum.AUTO;

  if (unit === ByteUnitEnum.BYTE || (isAutoMode && bytes < BASE ** 1)) {
    // TODO: handle blocks locale
    const pluralForm = /** @type {Extract<import('./getPluralForm').PluralForm, 'one' | 'other'>} */ (
      getPluralForm('en-US', bytes)
    );
    const pluralized = {
      one: 'byte',
      other: 'bytes',
    }[pluralForm];

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
