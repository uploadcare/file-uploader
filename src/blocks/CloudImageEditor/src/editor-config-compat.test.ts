import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../../abstract/controllers/ConfigController';
import { LocaleController } from '../../../abstract/controllers/LocaleController';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../../../abstract/UploaderRegistry';
import { subscribeUploaderConfigCompat } from './editor-config-compat';

const ctxNames = new Set<string>();

const createCtxName = (): string => {
  const ctxName = `editor-config-compat-${crypto.randomUUID()}`;
  ctxNames.add(ctxName);
  return ctxName;
};

/** Create + register the ctx's container (eagerly building Config/Router/Telemetry), matching a live uploader scope. */
const ensureCtx = (): { ctxName: string; config: ConfigController } => {
  const ctxName = createCtxName();
  const container = UploaderRegistry.ensure(ctxName);
  return { ctxName, config: container.get(ConfigController) };
};

describe('subscribeUploaderConfigCompat', () => {
  afterEach(() => {
    for (const ctxName of ctxNames) {
      UploaderRegistry.dispose(ctxName);
    }
    ctxNames.clear();
  });

  it('is inert when no sibling ctx exists', () => {
    const onConfig = vi.fn();
    const onLocale = vi.fn();
    const onTelemetry = vi.fn();

    const unsubscribe = subscribeUploaderConfigCompat(createCtxName(), onConfig, onLocale, onTelemetry);

    expect(onConfig).not.toHaveBeenCalled();
    expect(onLocale).not.toHaveBeenCalled();
    expect(onTelemetry).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('reads editor config from a pre-seeded sibling ctx', () => {
    const { ctxName, config } = ensureCtx();
    config.set('cdnCname', 'https://cdn.example.com/');
    const onConfig = vi.fn();

    const unsubscribe = subscribeUploaderConfigCompat(ctxName, onConfig, vi.fn());

    // Step-9 behavior: the initial patch always includes every editor key (the
    // `ConfigController` is seeded with all defaults), with the sibling's value
    // for the ones it wrote.
    expect(onConfig).toHaveBeenCalledTimes(1);
    expect(onConfig).toHaveBeenCalledWith(expect.objectContaining({ cdnCname: 'https://cdn.example.com/' }));
    const patch = onConfig.mock.calls[0]?.[0];
    expect(Object.keys(patch)).toEqual(
      expect.arrayContaining([
        'cdnCname',
        'secureDeliveryProxy',
        'secureDeliveryProxyUrlResolver',
        'cloudImageEditorMaskHref',
        'testMode',
        'debug',
      ]),
    );
    unsubscribe();
  });

  it('forwards later per-key config changes (deduped)', () => {
    const { ctxName, config } = ensureCtx();
    const onConfig = vi.fn();
    const unsubscribe = subscribeUploaderConfigCompat(ctxName, onConfig, vi.fn());
    onConfig.mockClear();

    config.set('testMode', true);
    expect(onConfig).toHaveBeenCalledWith({ testMode: true });

    onConfig.mockClear();
    // Setting the same value again must not re-fire (Object.is dedup).
    config.set('testMode', true);
    expect(onConfig).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('stops forwarding after unsubscribe', () => {
    const { ctxName, config } = ensureCtx();
    const onConfig = vi.fn();
    const unsubscribe = subscribeUploaderConfigCompat(ctxName, onConfig, vi.fn());
    unsubscribe();
    onConfig.mockClear();

    config.set('cdnCname', 'https://changed.example.com/');
    expect(onConfig).not.toHaveBeenCalled();
  });

  it('hands over an l10n bound to the sibling locale', () => {
    const { ctxName } = ensureCtx();
    const container = UploaderRegistry.get(ctxName);
    container?.get(LocaleController).set('greeting', 'Hello {{name}}');
    const onLocale = vi.fn();

    const unsubscribe = subscribeUploaderConfigCompat(ctxName, vi.fn(), onLocale);

    expect(onLocale).toHaveBeenCalledTimes(1);
    const l10n = onLocale.mock.calls[0]?.[0] as (key: string, vars?: Record<string, string>) => string;
    expect(l10n('greeting', { name: 'World' })).toBe('Hello World');
    unsubscribe();
  });

  it('hands over the ctx TelemetryManager immediately', () => {
    const { ctxName } = ensureCtx();
    const onTelemetry = vi.fn();

    const unsubscribe = subscribeUploaderConfigCompat(ctxName, vi.fn(), vi.fn(), onTelemetry);

    expect(onTelemetry).toHaveBeenCalledTimes(1);
    expect(onTelemetry.mock.calls[0]?.[0]).toBeInstanceOf(TelemetryManager);
    unsubscribe();
  });
});
