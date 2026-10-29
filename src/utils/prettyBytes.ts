import { getPluralForm } from './getPluralForm';

const UNITS = ['KB', 'MB', 'GB', 'TB', 'PB'];

export const prettyBytes = (bytes: number): string => {
  if (bytes < 1000) {
    return `${bytes} ${getPluralForm('en-US', bytes) === 'one' ? 'byte' : 'bytes'}`;
  }
  let i = 0;
  while (i < UNITS.length - 1 && bytes >= 1000 ** (i + 2)) i++;
  return `${Math.ceil((bytes / 1000 ** (i + 1)) * 100) / 100} ${UNITS[i]}`;
};
