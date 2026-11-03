import { type EnglishTemplates, default as en } from '../locales/file-uploader/en';
import { logger } from './logger';

const log = logger.scope('locale-registry');

/** The keys of the English dictionary, each a translated string. */
export type LocaleDefinition = typeof en;
export type { EnglishTemplates };
/** What a locale defines: any of the English keys and the custom ones; a missing key falls back to English. */
type LocaleInput = Partial<LocaleDefinition & CustomLocaleDefinition>;
export type LocaleDefinitionResolver = () => Promise<LocaleInput>;

/**
 * Interface for TypeScript module augmentation.
 * Plugins should extend this interface to add their own locale string keys, so
 * `localeDefinitionOverride` is typed for them instead of a loose record.
 *
 * @example
 * ```typescript
 * declare module '@uploadcare/file-uploader' {
 *   interface CustomLocaleDefinition {
 *     'my-plugin-title': string;
 *   }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: This interface is meant to be augmented by plugins
export interface CustomLocaleDefinition {}

const localeRegistry: Map<string, LocaleDefinition> = new Map();
const localeResolvers: Map<string, LocaleDefinitionResolver> = new Map();

const defineLocaleSync = (localeName: string, definition: LocaleInput): LocaleDefinition => {
  if (localeRegistry.has(localeName)) {
    log.warn(`Locale ${localeName} is already defined. Overwriting...`);
  }

  const locale: LocaleDefinition = { ...en, ...definition };
  localeRegistry.set(localeName, locale);

  return locale;
};

const defineLocaleAsync = (localeName: string, definitionResolver: LocaleDefinitionResolver): void => {
  localeResolvers.set(localeName, definitionResolver);
};

export const defineLocale = (
  localeName: string,
  definitionOrResolver: LocaleInput | LocaleDefinitionResolver,
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
