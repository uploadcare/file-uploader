import { expectTypeOf, test } from 'vitest';
import { defineLocale } from '../../dist/index';
import en from '../../dist/locales/file-uploader/en';

/** The documented way to write a locale: start from the English dictionary and replace its strings. */

test('the English dictionary types each value as a string, so a translation of it has its type', () => {
  expectTypeOf(en['upload-file']).toEqualTypeOf<string>();
  const no: typeof en = { ...en, 'upload-file': 'Velg fil' };
  defineLocale('no', no);
});
