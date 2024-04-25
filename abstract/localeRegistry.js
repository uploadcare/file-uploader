// @ts-check

import { default as en } from '../locales/file-uploader/en.js';

/** @type {Map<string, LocaleDefinition>} */
const localeRegistry = new Map();
/** @type {Map<string, LocaleDefinitionResolver>} */
const localeResolvers = new Map();

/** @typedef {Record<string, string>} LocaleDefinition */
/** @typedef {() => Promise<LocaleDefinition>} LocaleDefinitionResolver */

/**
 * @param {string} localeName
 * @param {LocaleDefinition} definition
 */
const defineLocaleSync = (localeName, definition) => {
  if (localeRegistry.has(localeName)) {
    console.log(`Locale ${localeName} is already defined. Overwriting...`);
  }

  localeRegistry.set(localeName, { ...en, ...definition });
};

/**
 * @param {string} localeName
 * @param {LocaleDefinitionResolver} definitionResolver
 */
const defineLocaleAsync = (localeName, definitionResolver) => {
  localeResolvers.set(localeName, definitionResolver);
};

/**
 * @param {string} localeName
 * @param {LocaleDefinition | LocaleDefinitionResolver} definitionOrResolver
 */
export const defineLocale = (localeName, definitionOrResolver) => {
  if (typeof definitionOrResolver === 'function') {
    defineLocaleAsync(localeName, definitionOrResolver);
  } else {
    defineLocaleSync(localeName, definitionOrResolver);
  }
};

/**
 * @param {string} localeName
 * @returns {Promise<LocaleDefinition>}
 */
export const resolveLocaleDefinition = async (localeName) => {
  if (!localeRegistry.has(localeName)) {
    if (!localeResolvers.has(localeName)) {
      throw new Error(`Locale ${localeName} is not defined`);
    }

    const definitionResolver = /** @type {LocaleDefinitionResolver} */ (localeResolvers.get(localeName));
    const definition = await definitionResolver();
    defineLocaleSync(localeName, definition);
  }

  return /** @type {LocaleDefinition} */ (localeRegistry.get(localeName));
};

defineLocale('en', en);
