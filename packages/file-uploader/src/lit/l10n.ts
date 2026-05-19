import type { LocaleDefinition } from '../abstract/localeRegistry';
import { localeStateKey } from '../abstract/managers/LocaleManager';
import { getPluralForm } from '../utils/getPluralForm';
import { applyTemplateData, getPluralObjects } from '../utils/template-utils';
import type { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';

export type L10nFunction = (str: string, variables?: Record<string, string | number>) => string;

export const createPluralizer = (getL10n: () => L10nFunction) => {
  return (key: string, count: number): string => {
    const l10n = getL10n();
    const locale = l10n('locale-id') || 'en';
    const pluralForm = getPluralForm(locale, count);
    return l10n(`${key}__${pluralForm}`);
  };
};

export const createL10n = (getCtx: () => PubSub<SharedState>) => {
  const pluralizer = createPluralizer(() => l10n);
  const l10n = (str: string, variables: Record<string, string | number> = {}): string => {
    if (!str) {
      return '';
    }
    const ctx = getCtx();
    const template = ctx.read(localeStateKey(str as keyof LocaleDefinition)) || str;
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
