import type { LocaleController } from '../abstract/controllers/LocaleController';
import { getPluralForm } from '../utils/getPluralForm';
import { applyTemplateData, getPluralObjects } from '../utils/template-utils';

export type L10nFunction = (str: string, variables?: Record<string, string | number>) => string;

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
 */
export const createL10n = (getLocale: () => LocaleController) => {
  const pluralizer = createPluralizer(() => l10n);
  const l10n = (str: string, variables: Record<string, string | number> = {}): string => {
    if (!str) {
      return '';
    }
    const template = getLocale().get(str) || str;
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
