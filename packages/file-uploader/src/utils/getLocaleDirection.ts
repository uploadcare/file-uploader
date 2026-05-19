type LocaleWithDirection = Intl.Locale & {
  textInfo?: { direction?: string };
  getTextInfo?: () => { direction?: string };
};

export const getLocaleDirection = (localeId: string): string => {
  const locale = new Intl.Locale(localeId) as LocaleWithDirection;
  let direction = 'ltr';
  const fromGetter = locale.getTextInfo?.().direction;
  if (fromGetter) {
    direction = fromGetter;
  } else if (locale.textInfo?.direction) {
    direction = locale.textInfo.direction;
  }
  return direction;
};
