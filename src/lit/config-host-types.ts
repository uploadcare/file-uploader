import type { CustomConfig } from '../abstract/customConfigOptions';
import type { ConfigPlainType, ConfigType } from '../types';

/**
 * The attribute/JSX typing surface a config host exposes. Kept identical to what
 * `<uc-config>` hand-declared before the extraction (`Partial<ConfigPlainType> &
 * { 'ctx-name': string }`): only plain (attribute-representable) keys are
 * optional attributes, plus the required `ctx-name`. Consumed by the JSX
 * `ReflectAttributes<T> = T['attributesMeta']` plumbing (see `types/jsx.d.ts`).
 */
export type ConfigHostAttributesMeta = Partial<ConfigPlainType> & { 'ctx-name': string };

/**
 * The instance shape any `WithConfig(...)` host gains — the single source of
 * truth is `ConfigType`, so adding a config option types every host
 * automatically. Mirrors the former `export interface Config extends ConfigType,
 * CustomConfig {}` + the `declare attributesMeta` on `<uc-config>` exactly, now
 * derived once here instead of hand-declared per block.
 */
export interface ConfigHost extends ConfigType, CustomConfig {
  attributesMeta: ConfigHostAttributesMeta;
}
