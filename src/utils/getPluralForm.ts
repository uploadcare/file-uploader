export const getPluralForm = (locale: string, count: number): Intl.LDMLPluralRule => {
  const pluralForm = new Intl.PluralRules(locale).select(count);
  return pluralForm;
};
