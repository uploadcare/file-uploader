import { getPluralForm } from '../utils/getPluralForm';
import { applyTemplateData, getPluralObjects } from '../utils/template-utils';
import type { LocaleController } from './controllers/LocaleController';
import type { CustomLocaleDefinition, LocaleDefinition } from './localeRegistry';

export type L10nFunction = (str: string, variables?: Record<string, string | number>) => string;

export type L10nKey = keyof LocaleDefinition | keyof CustomLocaleDefinition;

declare const plainTextBrand: unique symbol;

/** Text meant to be shown as written rather than as an l10n key. Made with {@link plainText}. */
export type PlainText = string & { readonly [plainTextBrand]: true };

/**
 * Marks `text` as meant to be shown as written, for a plugin label that is not an l10n key. It is still looked up in
 * the locale like any label, so text that happens to equal a key shows that key's translation.
 */
export const plainText = (text: string): PlainText => text as PlainText;

/** A literal key has to exist in the dictionary, or be marked `PlainText`. A `string` from elsewhere still passes. */
export type CheckedL10nKey<K extends string> = K extends L10nKey | PlainText ? K : string extends K ? K : never;

/** `L10nFunction` for the blocks' own calls, where a misspelt literal key fails to compile. */
export type CheckedL10nFunction = <K extends string>(
  key: CheckedL10nKey<K>,
  variables?: Record<string, string | number>,
) => string;

export const createPluralizer = (getL10n: () => L10nFunction) => {
  return (key: string, count: number): string => {
    const l10n = getL10n();
    const locale = l10n('locale-id') || 'en';
    const pluralForm = getPluralForm(locale, count);
    return l10n(`${key}__${pluralForm}`);
  };
};

/**
 * Build an l10n function that reads the resolved dictionary directly from the
 * ctx's {@link LocaleController} (M-god step 7: off the `*l10n/*` PubSub facade).
 * `getLocale` is called live on every lookup so a later dictionary load / locale
 * switch is reflected without re-creating the function.
 *
 * Lookups use the controller's `getTracked`, so calling `l10n(key)` inside a
 * `SignalWatcher` render (every `ChildBlock`) auto-tracks that key and re-renders
 * the block when the dictionary loads or the locale switches — replacing the
 * explicit `subscriptionsFor` locale subscription blocks used to declare. Outside
 * a watcher (e.g. `api.l10n(...)`) `getTracked` is a plain read, so callers that
 * are not reactive consumers are unaffected.
 */
export const createL10n = (getLocale: () => LocaleController) => {
  const pluralizer = createPluralizer(() => l10n);
  const l10n = (str: string, variables: Record<string, string | number> = {}): string => {
    if (!str) {
      return '';
    }
    const template = getLocale().getTracked(str) || str;
    const pluralObjects = getPluralObjects(template);
    for (const pluralObject of pluralObjects) {
      variables[pluralObject.variable] = pluralizer(
        pluralObject.pluralKey,
        Number(variables[pluralObject.countVariable]),
      );
    }
    const result = applyTemplateData(template, variables);
    return result;
  };

  return l10n;
};
