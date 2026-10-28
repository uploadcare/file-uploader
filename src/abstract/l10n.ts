import { getPluralForm } from '../utils/getPluralForm';
import { applyTemplateData, getPluralObjects } from '../utils/template-utils';
import type { LocaleController } from './controllers/LocaleController';
import type { CustomLocaleDefinition, EnglishTemplates, LocaleDefinition } from './localeRegistry';

export type L10nFunction = (str: string, variables?: Record<string, string | number>) => string;

export type L10nKey = keyof LocaleDefinition | keyof CustomLocaleDefinition;

declare const plainTextBrand: unique symbol;

/**
 * Text meant to be shown as written rather than as an l10n key: assert it, `'My source' as PlainText`. It is still
 * looked up in the locale like any label, so text that happens to equal a key shows that key's translation.
 */
export type PlainText = string & { readonly [plainTextBrand]: true };

/** A key has to exist in the dictionary, or be text marked `PlainText`; a bare `string` does not pass. */
export type CheckedL10nKey<K extends string> = K extends L10nKey | PlainText ? K : never;

type L10nVariables = Record<string, string | number>;

/** The variables a template interpolates: `{{name}}`, and the count behind `{{plural:file(count)}}`. */
type TemplateVariables<T extends string> = T extends `${string}{{${infer Placeholder}}}${infer Rest}`
  ? (Placeholder extends `plural:${string}(${infer Count})` ? Count : Placeholder) | TemplateVariables<Rest>
  : never;

type Templates = EnglishTemplates & CustomLocaleDefinition;

/**
 * The variables argument for `key`: exactly its template's variables, none for a template without any. A key whose
 * template is only known as `string` (a plugin's, or text marked `PlainText`) takes any.
 */
export type L10nArguments<K extends string> = K extends keyof Templates
  ? Templates[K] extends string
    ? string extends Templates[K]
      ? [variables?: L10nVariables]
      : [TemplateVariables<Templates[K]>] extends [never]
        ? []
        : [variables: Record<TemplateVariables<Templates[K]>, string | number>]
    : [variables?: L10nVariables]
  : [variables?: L10nVariables];

/** `L10nFunction` for the blocks' own calls: an unknown key, or a template's missing or unknown variable, fails to compile. */
export type CheckedL10nFunction = <K extends string>(key: CheckedL10nKey<K>, ...variables: L10nArguments<K>) => string;

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
