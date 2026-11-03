import { expectTypeOf, test } from 'vitest';
import { defineLocale } from '../../dist/index';
import en from '../../dist/locales/file-uploader/en';

/** The documented way to write a locale: start from the English dictionary and replace its strings. */

test('the English dictionary types each value as a string, so a translation of it has its type', () => {
  expectTypeOf(en['upload-file']).toEqualTypeOf<string>();
  const no: typeof en = { ...en, 'upload-file': 'Velg fil' };
  defineLocale('no', no);
});

declare module '../../dist/index' {
  interface CustomLocaleDefinition {
    'filename-no-spaces': string;
  }
}

test('a locale may define only some keys, and the custom keys a plugin declared', () => {
  defineLocale('pt', { 'upload-file': 'Carregar arquivo' });
  defineLocale('en', { ...en, 'filename-no-spaces': 'Filenames cannot contain spaces' });
  defineLocale('es', async () => ({ 'upload-file': 'Subir archivo', 'filename-no-spaces': 'Sin espacios' }));
  // @ts-expect-error an undeclared key
  defineLocale('de', { 'not-declared': 'x' });
});
