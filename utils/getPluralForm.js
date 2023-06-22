// @ts-check

/** @typedef {Intl.LDMLPluralRule} PluralForm */

/**
 * @param {string} locale
 * @param {number} count
 * @returns {PluralForm}
 */
export const getPluralForm = (locale, count) => {
  const pluralForm = new Intl.PluralRules(locale).select(count);
  return pluralForm;
};
