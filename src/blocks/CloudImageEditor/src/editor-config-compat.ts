import type { EditorConfig } from '../../../abstract/controllers/CloudImageEditorController';
import { ConfigController } from '../../../abstract/controllers/ConfigController';
import { LocaleController } from '../../../abstract/controllers/LocaleController';
import type { ControllerContainer } from '../../../abstract/di/ControllerContainer';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../../../abstract/UploaderRegistry';
import { createL10n } from '../../../lit/l10n';

// COMPAT ONLY — the sole uploader-ctx dependency for editor config/telemetry.
// Deletion steps: delete this file + its single call site in
// CloudImageEditorBlock; the editor's own props remain the config source.
//
// M-god step 9b-3: repointed off the v1 ctx facade onto the ctx's DI container. The
// sibling `<uc-config>`'s `ConfigController`/`LocaleController`/`TelemetryManager`
// are resolved through `UploaderRegistry.whenAvailable` and read directly, so
// this no longer touches `PubSub`/the `*cfg/` key helper/the `*`-keyed store. Those
// three controllers are already in the editor bundle (safe — no `PluginController`
// / `UploaderPublicApi` value import lands here).

const EDITOR_CONFIG_KEYS = [
  'cdnCname',
  'secureDeliveryProxy',
  'secureDeliveryProxyUrlResolver',
  'cloudImageEditorMaskHref',
  'testMode',
  'debug',
] as const satisfies readonly (keyof EditorConfig)[];

/** Hands the consumer an l10n function bound to the sibling `<uc-config>`'s locale (interpolating, reads the ctx live). */
type LocaleCompatCallback = (l10n: (key: string, variables?: Record<string, string | number>) => string) => void;

const noop = (): void => {};

/**
 * Snapshot the editor-relevant config keys off the ctx's `ConfigController`.
 *
 * The controller is seeded with every built-in default at construction, so each
 * of these keys is always present — the `undefined` guard only ever elides a key
 * whose default is genuinely `undefined` (none of the five are). This is the
 * documented step-9 behavior: the initial patch now always includes every key
 * (accepted), whereas the v1 `*cfg/*` store-presence check could omit keys whose
 * `<uc-config>` sibling hadn't written them yet.
 */
function readConfigPatch(config: ConfigController): Partial<EditorConfig> {
  const patch: Partial<EditorConfig> = {};
  for (const key of EDITOR_CONFIG_KEYS) {
    const value = config.get(key);
    if (value !== undefined) {
      Object.assign(patch, { [key]: value });
    }
  }
  return patch;
}

function attach(
  container: ControllerContainer,
  onConfig: (patch: Partial<EditorConfig>) => void,
  onLocale?: LocaleCompatCallback,
  onTelemetry?: (telemetryManager: TelemetryManager) => void,
): () => void {
  const config = container.get(ConfigController);

  const initialPatch = readConfigPatch(config);
  if (Object.keys(initialPatch).length > 0) {
    onConfig(initialPatch);
  }

  // Hand over an l10n bound to this ctx's locale — restores the interpolating
  // labels the editor used to read from the shared ctx directly. `createL10n`
  // reads the `LocaleController` live, so later locale population is reflected.
  onLocale?.(createL10n(() => container.get(LocaleController)));

  // The `TelemetryManager` is eagerly constructed with the container
  // (`UploaderRegistry.ensure`), so it is always present here — no need to wait
  // on / re-subscribe to a `*telemetryManager` registration as the v1 store did.
  onTelemetry?.(container.get(TelemetryManager));

  // Per-key change forwarding over `ConfigController`'s coarse `subscribe`
  // (`Object.is` dedup reproduces the v1 per-`*cfg/*`-key `ctx.sub(..., false)`:
  // no immediate fire — the initial values already went out via `initialPatch`).
  const unsubscribers = EDITOR_CONFIG_KEYS.map((key) => {
    let last = config.get(key);
    return config.subscribe(() => {
      const next = config.get(key);
      if (!Object.is(next, last)) {
        last = next;
        onConfig({ [key]: next } as Partial<EditorConfig>);
      }
    });
  });

  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}

export function subscribeUploaderConfigCompat(
  ctxName: string,
  onConfig: (patch: Partial<EditorConfig>) => void,
  onLocale?: LocaleCompatCallback,
  onTelemetry?: (telemetryManager: TelemetryManager) => void,
): () => void {
  // Bind now if the sibling ctx's container already exists, or WHEN it registers
  // — a `<uc-config>` sibling connects AFTER the editor in the documented
  // composition, so a one-shot lookup would miss it and stay permanently inert.
  // `whenAvailable` also re-fires across a remount (new container) and with
  // `null` on teardown — detach the previous cycle each time so a stale
  // subscription never outlives the container it read from.
  let detach = noop;
  const cancelWaiter = UploaderRegistry.whenAvailable(ctxName, (container) => {
    detach();
    detach = noop;
    if (container) {
      detach = attach(container, onConfig, onLocale, onTelemetry);
    }
  });
  return () => {
    cancelWaiter();
    detach();
  };
}
