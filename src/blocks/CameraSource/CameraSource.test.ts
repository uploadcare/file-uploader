import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { delay } from '../../utils/delay';
import { CameraSource } from './CameraSource';

// Idempotent (same path as defineComponents(UC)).
CameraSource.reg('uc-camera-source');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `camera-source-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: CameraSource; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-camera-source') as CameraSource;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

const videoEl = (el: CameraSource): HTMLVideoElement | null => el.querySelector('video');

describe('CameraSource (M-god step 6b-3 migration)', () => {
  it('resolves its always-bound dependencies via @inject fields on the element', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    const container = UploaderRegistry.get(ctxName);
    // Always-bound controllers become `@inject` fields resolving through the
    // container the block adopted (tagged as `this[CONTAINER]`); the
    // uploader-scope-bound `UploaderPublicApi` (read via `use()` in `_toSend`)
    // deliberately stays off `@inject`.
    const injected = el as unknown as {
      _config: ConfigController;
      _router: RouterController;
      _telemetry: TelemetryManager;
    };
    expect(injected._config).toBe(config);
    expect(injected._router).toBe(container?.get(RouterController));
    expect(injected._telemetry).toBe(container?.get(TelemetryManager));
  });

  it('re-renders the video transform reactively when cameraMirror changes (getTracked, no subConfigValue)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    // Default cameraMirror is false -> no mirror transform. (happy-dom serializes
    // an omitted styleMap value inconsistently, so assert on the mirror token.)
    expect(videoEl(el)?.style.transform).not.toContain('scaleX(-1)');

    // External config change; the tracked `cameraMirror` read in the
    // `_videoTransformCss` getter re-renders the video transform.
    config.set('cameraMirror', true);
    await el.updateComplete;
    await delay(0);
    expect(videoEl(el)?.style.transform).toContain('scaleX(-1)');

    config.set('cameraMirror', false);
    await el.updateComplete;
    await delay(0);
    expect(videoEl(el)?.style.transform).not.toContain('scaleX(-1)');
  });
});
