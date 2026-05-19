import { default as en } from '../locales/file-uploader/en';

export type LocaleDefinition = typeof en;
export type LocaleDefinitionResolver = () => Promise<LocaleDefinition>;

const localeRegistry: Map<string, LocaleDefinition> = new Map();
const localeResolvers: Map<string, LocaleDefinitionResolver> = new Map();

const defineLocaleSync = (localeName: string, definition: LocaleDefinition): LocaleDefinition => {
  if (localeRegistry.has(localeName)) {
    console.log(`Locale ${localeName} is already defined. Overwriting...`);
  }

  const locale: LocaleDefinition = { ...(en as unknown as LocaleDefinition), ...definition };
  localeRegistry.set(localeName, locale);

  return locale;
};

const defineLocaleAsync = (localeName: string, definitionResolver: LocaleDefinitionResolver): void => {
  localeResolvers.set(localeName, definitionResolver);
};

export const defineLocale = (
  localeName: string,
  definitionOrResolver: LocaleDefinition | LocaleDefinitionResolver,
): void => {
  if (typeof definitionOrResolver === 'function') {
    defineLocaleAsync(localeName, definitionOrResolver);
  } else {
    defineLocaleSync(localeName, definitionOrResolver);
  }
};

export const resolveLocaleDefinition = async (localeName: string): Promise<LocaleDefinition> => {
  let localeDefinition = localeRegistry.get(localeName);

  if (!localeDefinition) {
    const definitionResolver = localeResolvers.get(localeName);
    if (!definitionResolver) {
      throw new Error(`Locale ${localeName} is not defined`);
    }

    const definition = await definitionResolver();
    localeDefinition = defineLocaleSync(localeName, definition);
  }

  return localeDefinition;
};

defineLocale('en', en);
