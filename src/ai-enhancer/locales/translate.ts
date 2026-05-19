import { enLocale } from './en';

export function translate(key: keyof typeof enLocale, overrides?: Partial<typeof enLocale>): string {
  return overrides?.[key] ?? enLocale[key];
}
