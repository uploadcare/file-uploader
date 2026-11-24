type LocaleWithDirection = Intl.Locale & {
  textInfo?: { direction?: string };
  getTextInfo?: () => { direction?: string };
};

export const getLocaleDirection = (localeId: string): string => {
  const locale = new Intl.Locale(localeId) as LocaleWithDirection;
  return locale.getTextInfo?.().direction || locale.textInfo?.direction || 'ltr';
};
