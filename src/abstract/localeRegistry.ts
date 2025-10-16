import { default as en } from '../locales/file-uploader/en';

export type LocaleDefinition = Record<string, string>;
export type LocaleDefinitionResolver = () => Promise<LocaleDefinition>;

const localeRegistry: Map<string, LocaleDefinition> = new Map();
const localeResolvers: Map<string, LocaleDefinitionResolver> = new Map();

const defineLocaleSync = (localeName: string, definition: LocaleDefinition): void => {
  if (localeRegistry.has(localeName)) {
    console.log(`Locale ${localeName} is already defined. Overwriting...`);
  }

  localeRegistry.set(localeName, { ...(en as unknown as LocaleDefinition), ...definition });
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
  if (!localeRegistry.has(localeName)) {
    if (!localeResolvers.has(localeName)) {
      throw new Error(`Locale ${localeName} is not defined`);
    }

    const definitionResolver = localeResolvers.get(localeName)!;
    const definition = await definitionResolver();
    defineLocaleSync(localeName, definition);
  }

  return localeRegistry.get(localeName)!;
};

defineLocale('en', en);
