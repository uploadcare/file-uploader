// @ts-check
/** @param {string} localeId */
export const getLocaleDirection = (localeId) => {
  /**
   * @type {typeof Intl.Locale & {
   *   textInfo?: { direction: string };
   *   getTextInfo?: () => { direction: string };
   * }}
   */
  const locale = /** @type {any} */ (new Intl.Locale(localeId));
  let direction = 'ltr';
  if (typeof locale.getTextInfo === 'function' && locale.getTextInfo().direction) {
    direction = locale.getTextInfo().direction;
  } else if ('textInfo' in locale && locale.textInfo?.direction) {
    direction = locale.textInfo.direction;
  }
  return direction;
};
