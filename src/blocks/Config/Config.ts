import { ChildBlock } from '../../lit/ChildBlock';
import { WithConfig } from '../../lit/WithConfig';
import './config.css';

/**
 * `<uc-config>` — the config host element. All of its behavior (the
 * element↔`ConfigController` attribute/property adapter, custom plugin configs,
 * computed properties, change-log, and the one-host-per-ctx warning) lives in
 * the reusable {@link WithConfig} mixin, so any block can host config the same
 * way. This element is just `WithConfig(ChildBlock)` + its styles.
 */
export class Config extends WithConfig(ChildBlock) {}

declare global {
  interface HTMLElementTagNameMap {
    'uc-config': Config;
  }
}
