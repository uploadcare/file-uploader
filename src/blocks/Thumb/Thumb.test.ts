import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import type { Uid } from '../../lit/Uid';
import { delay } from '../../utils/delay';
import { Thumb } from './Thumb';

// Idempotent (same path as defineComponents(UC)).
Thumb.reg('uc-thumb');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `thumb-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: Thumb; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-thumb') as Thumb;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  return { el, config };
};

const badgeIconName = (el: Thumb): string | null => el.querySelector('.uc-badge uc-icon')?.getAttribute('name') ?? null;

describe('Thumb (M-god step 6b-6 migration)', () => {
  it('resolves its always-bound dependencies via @inject fields on the element', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    const container = UploaderRegistry.get(ctxName);
    // `ConfigController` / `TelemetryManager` become `@inject` fields resolving
    // through the container the block adopted (tagged as `this[CONTAINER]`); the
    // uploader-scope-bound `UploadCollectionController` (read via `useOrNull`)
    // stays off `@inject`.
    const injected = el as unknown as { _config: ConfigController; _telemetry: TelemetryManager };
    expect(injected._config).toBe(config);
    expect(injected._telemetry).toBe(container?.get(TelemetryManager));
  });

  it('adopts the controller (reading filesViewMode via use(ConfigController)) without throwing in grid mode', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    // Seed grid mode before mount so controllerReady's `_firstViewMode` init reads
    // it through `use(ConfigController).get('filesViewMode')`.
    UploaderRegistry.get(ctxName)?.get(ConfigController).set('filesViewMode', 'grid');
    const { el } = await mount(ctxName);
    expect(el.isConnected).toBe(true);
    expect(el.querySelector('.uc-thumb')).not.toBeNull();
  });

  it('renders the badge icon from the badgeIcon property', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    el.badgeIcon = 'badge-success';
    await el.updateComplete;
    await delay(0);
    expect(badgeIconName(el)).toBe('badge-success');
  });

  it('builds the thumbnail url from cname, uuid and the entry modifiers', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    const collection = UploaderRegistry.get(ctxName)?.get(UploadCollectionController);
    if (!collection) throw new Error('collection controller not resolved');

    // `proxyUrl` is what `_generateThumbnail` calls with the fully-built CDN url,
    // right before handing it to `preloadImage` — which never settles under
    // happy-dom (no real image loading), so `entry.thumbUrl` itself never
    // updates in this environment. Spying here pins the exact string the block
    // builds without depending on image-load plumbing. `proxyUrl` calls through
    // to its real implementation (identity here — no secure-delivery proxy is
    // configured).
    const proxyUrl = vi.spyOn(el as unknown as { proxyUrl(url: string): Promise<string> }, 'proxyUrl');

    // UUID must be real: `parseCdnUrl` validates the grammar.
    const uuid = 'c2499162-eb07-4b93-b31e-94a89a47e858';
    const uid = collection.add({
      fileInfo: { uuid } as never,
      isImage: true,
      uuid,
      cdnUrlModifiers: null,
    });
    el.uid = uid as Uid;
    await el.updateComplete;
    await delay(0);

    expect(proxyUrl).toHaveBeenCalledWith(`https://ucarecdn.com/${uuid}/-/stretch/off/-/scale_crop/76x76/center/`);
  });
});
