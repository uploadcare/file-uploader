import type { EditorConfig } from '../../../abstract/controllers/CloudImageEditorController';
import { LocaleController } from '../../../abstract/controllers/LocaleController';
import type { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { sharedConfigKey } from '../../../abstract/sharedConfigKey';
import { createL10n } from '../../../lit/l10n';
import { PubSub } from '../../../lit/PubSubCompat';
import type { SharedState } from '../../../lit/SharedState';
import { initialConfig } from '../../Config/initialConfig';

// COMPAT ONLY — the sole uploader-ctx dependency for editor config/telemetry.
// Deletion steps: delete this file + its single call site in
// CloudImageEditorBlock; the editor's own props remain the config source.

const EDITOR_CONFIG_KEYS = [
  'cdnCname',
  'secureDeliveryProxy',
  'secureDeliveryProxyUrlResolver',
  'cloudImageEditorMaskHref',
  'testMode',
] as const satisfies readonly (keyof EditorConfig)[];

type EditorConfigKey = (typeof EDITOR_CONFIG_KEYS)[number];

/** Hands the consumer an l10n function bound to the sibling `<uc-config>`'s locale (interpolating, reads the ctx live). */
type LocaleCompatCallback = (l10n: (key: string, variables?: Record<string, string | number>) => string) => void;

const noop = (): void => {};

const hasStoreKey = <K extends keyof SharedState>(ctx: Pick<PubSub<SharedState>, 'store'>, key: K): boolean =>
  Object.hasOwn(ctx.store, key);

function readConfigValue<K extends EditorConfigKey>(ctx: PubSub<SharedState>, key: K): EditorConfig[K] | undefined {
  const stateKey = sharedConfigKey(key);
  if (hasStoreKey(ctx, stateKey)) {
    return ctx.store[stateKey] as unknown as EditorConfig[K];
  }
  return ctx.read(stateKey) as unknown as EditorConfig[K];
}

function readConfigPatch(ctx: PubSub<SharedState>): Partial<EditorConfig> {
  const patch: Partial<EditorConfig> = {};
  for (const key of EDITOR_CONFIG_KEYS) {
    const stateKey = sharedConfigKey(key);
    const value = readConfigValue(ctx, key);
    if (value !== undefined && (hasStoreKey(ctx, stateKey) || !Object.is(value, initialConfig[key]))) {
      Object.assign(patch, { [key]: value });
    }
  }
  return patch;
}

function attach(
  ctx: PubSub<SharedState>,
  onConfig: (patch: Partial<EditorConfig>) => void,
  onLocale?: LocaleCompatCallback,
  onTelemetry?: (telemetryManager: TelemetryManager) => void,
): () => void {
  const initialPatch = readConfigPatch(ctx);
  if (Object.keys(initialPatch).length > 0) {
    onConfig(initialPatch);
  }

  // Hand over an l10n bound to this ctx's locale — restores the interpolating
  // labels the editor used to read from the shared ctx directly. `createL10n`
  // reads the `LocaleController` live (M-god step 7), so later locale population
  // is reflected. The `*cfg/*` config reads below stay on the facade until the
  // step-9 editor repoint; this is the minimal getter change forced by
  // `createL10n`'s new signature.
  onLocale?.(createL10n(() => ctx.container().get(LocaleController)));

  const telemetryManager = ctx.store['*telemetryManager'];
  if (telemetryManager) {
    onTelemetry?.(telemetryManager);
  }

  const unsubscribers = EDITOR_CONFIG_KEYS.map((key) => {
    const stateKey = sharedConfigKey(key);
    return ctx.sub(stateKey, (value) => onConfig({ [key]: value } as Partial<EditorConfig>), false);
  });

  unsubscribers.push(
    ctx.sub(
      '*telemetryManager',
      (nextTelemetryManager) => {
        if (nextTelemetryManager) {
          onTelemetry?.(nextTelemetryManager);
        }
      },
      false,
    ),
  );

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
  // Bind now if the sibling ctx already exists, or WHEN it's created — a
  // `<uc-config>` sibling connects AFTER the editor in the documented
  // composition, so a one-shot lookup would miss it and stay permanently inert.
  // The `*cfg/*` subscriptions established on bind then catch `<uc-config>`'s
  // later config population.
  let detach = noop;
  const cancelWaiter = PubSub.whenCtx<SharedState>(ctxName, (ctx) => {
    detach = attach(ctx, onConfig, onLocale, onTelemetry);
  });
  return () => {
    cancelWaiter();
    detach();
  };
}
