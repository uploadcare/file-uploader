import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { chromium } from 'playwright';

type LocaleDefinition = Record<string, string>;
type LocalesPerGroup = Record<string, Record<string, LocaleDefinition>>;

const REFERENCE_LOCALE: string = 'en';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const LOCALES_PATH = path.resolve(path.join(__dirname, '../src/locales'));

const localeGroups: string[] = await fs.readdir(LOCALES_PATH);
const localesPerGroup: LocalesPerGroup = {};

for (const group of localeGroups) {
  const locales = (await fs.readdir(path.join(LOCALES_PATH, group))).filter((filename: string) =>
    filename.endsWith('.ts'),
  );
  localesPerGroup[group] = {};

  for (const locale of locales) {
    const module = (await import(path.join(LOCALES_PATH, group, locale))) as {
      default: LocaleDefinition;
    };
    localesPerGroup[group][locale.replace('.ts', '')] = module.default;
  }
}

const getMissingKeys = (reference: LocaleDefinition, definition: LocaleDefinition): string[] => {
  const missingKeys: string[] = [];

  for (const key in reference) {
    if (!definition[key]) {
      missingKeys.push(key);
    }
  }

  return missingKeys;
};

(async () => {
  let anyError = false;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  for (const group of Object.keys(localesPerGroup)) {
    console.log(`Checking group "${group}"`);
    const referenceDefinition = localesPerGroup[group][REFERENCE_LOCALE];
    if (!referenceDefinition) {
      console.error(`Reference locale "${REFERENCE_LOCALE}" not found for group "${group}"`);
      anyError = true;
      continue;
    }

    for (const localeName of Object.keys(localesPerGroup[group])) {
      console.log(`Checking locale "${localeName}" in group "${group}"`);
      const definition = localesPerGroup[group][localeName];
      const localeId = definition['locale-id'];
      const socialSourceLang = definition['social-source-lang'];
      if (!localeId) {
        console.error(`Missing locale-id for locale "${localeName}" in group "${group}"`);
        anyError = true;
      }

      if (!socialSourceLang) {
        console.error(
          `Missing social-source-lang for locale "${localeName}" in group "${group}" (locale-id: "${localeId}")`,
        );
        anyError = true;
      }

      const isValidLocaleId = await page.evaluate<boolean, string>((id) => {
        try {
          new Intl.PluralRules(id);
          return true;
        } catch (_err) {
          return false;
        }
      }, localeId);

      if (!isValidLocaleId) {
        console.error(`Invalid locale-id "${localeId}" for locale "${localeName}" in group "${group}"`);
        anyError = true;
      }

      const pluralCategories = await page.evaluate<string[], string>((id) => {
        const pluralRules = new Intl.PluralRules(id);
        const options = pluralRules.resolvedOptions();
        return options.pluralCategories;
      }, localeId);

      const missingKeys = getMissingKeys(referenceDefinition, definition);

      if (missingKeys.length > 0) {
        console.error(`Missing keys for locale ${localeName} in group ${group}: ${missingKeys.join(', ')}`);
        anyError = true;
      }

      const pluralKeys = Object.keys(definition)
        .filter((key) => key.includes('__'))
        .reduce<Record<string, string[]>>((acc, key) => {
          const [baseKey, pluralCategory] = key.split('__');
          if (!acc[baseKey]) {
            acc[baseKey] = [];
          }
          acc[baseKey].push(pluralCategory);
          return acc;
        }, {});

      for (const key of Object.keys(pluralKeys)) {
        const missingPluralCategories = pluralCategories.filter((category) => !pluralKeys[key].includes(category));
        if (missingPluralCategories.length > 0) {
          console.error(
            `Missing plural categories for key"${key}" in locale ${localeName} in group ${group}: ${missingPluralCategories.join(
              ', ',
            )}`,
          );
          anyError = true;
        }
      }
    }
  }

  await context.close();
  await browser.close();

  if (anyError) {
    process.exit(1);
  }
})();
