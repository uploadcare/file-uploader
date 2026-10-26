import { RouterController } from '../abstract/controllers/RouterController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { EventEmitter } from '../abstract/EventEmitter';
import { LocaleManager } from '../abstract/managers/LocaleManager';
import { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { A11y } from './a11y';

/**
 * The one controller-side entry point that ensures a per-ctx
 * `ControllerContainer` exists for `ctxName`.
 *
 * Idempotent: `UploaderRegistry.ensure` returns the cached container if one
 * already exists (created by this function or a sibling `ChildBlock`), otherwise
 * creates it — eagerly resolving `ConfigController` → `RouterController` →
 * `TelemetryManager` at creation time (see `UploaderRegistry.ensure`).
 *
 * On top of that low-level create, this seam eagerly constructs the remaining
 * ctx-scoped managers (`EventEmitter`, `LocaleManager`, `A11y`) so their
 * construction-time side effects fire the moment the ctx exists — the same
 * timing the removed `*`-keyed shared-instance re-exposers gave, and reachable
 * with no element in the composition at all (a pure `ChildBlock` tree). Order
 * matters only for reverse-dispose ordering; it mirrors the previous re-exposer
 * registration order.
 *
 * `ClipboardController` is deliberately NOT constructed here: it has no
 * construction-time side effect (its `paste` listener arms lazily on the first
 * registered scope), and scopes are only ever registered per-solution by
 * `SolutionChildBlock.controllerReady`. Keeping it out of this shared seam keeps
 * it — and its value import of `UploaderPublicApi` — out of the editor-alone
 * bundle's `ChildBlock` graph, so the clipboard can `@inject` the real public API
 * directly without breaching the `uc-cloud-image-editor` size-limit.
 *
 * It then activates `LocaleManager` (seed the `en` dictionary, subscribe to
 * `localeName`/`localeDefinitionOverride`) without touching its plugin-manager
 * coupling: `ensurePluginManager` couples it when it creates the
 * `PluginController`. Naming that class here would pull the plugin stack into the
 * editor bundle, which shares this seam through `ChildBlock`.
 */
export function ensureUploaderCtx(ctxName: string): ControllerContainer {
  const container = UploaderRegistry.ensure(ctxName);

  container.get(EventEmitter);
  container.get(LocaleManager);
  container.get(A11y);
  container.get(RouterController);
  container.get(TelemetryManager);

  container.get(LocaleManager).activate();

  return container;
}
