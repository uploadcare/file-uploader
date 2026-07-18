import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
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
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: CameraSource; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = PubSub.getContainer(ctxName)?.get(ConfigController);
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
  it('declares its dependencies via static uses', () => {
    expect(CameraSource.uses).toEqual([ConfigController, RouterController, TelemetryManager, UploaderPublicApi]);
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
