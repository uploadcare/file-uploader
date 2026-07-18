import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { SourceBtn } from './SourceBtn';

// Idempotent (same path as defineComponents(UC)).
SourceBtn.reg('uc-source-btn');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `source-btn-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (ctxName: string): Promise<SourceBtn> => {
  const el = document.createElement('uc-source-btn') as SourceBtn;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

describe('SourceBtn (M-god step 6b-1 migration)', () => {
  it('declares its dependency via static uses (TelemetryManager only — not ConfigController)', () => {
    expect(SourceBtn.uses).toEqual([TelemetryManager]);
    // Guard against accidentally over-declaring: SourceBtn reads no config.
    expect(SourceBtn.uses).not.toContain(ConfigController);
  });

  it('routes activate() telemetry through the container-resolved TelemetryManager (use())', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = UploaderRegistry.get(ctxName);
    expect(container).toBeDefined();
    const telemetry = container?.get(TelemetryManager);
    expect(telemetry).toBeDefined();
    const spy = vi.spyOn(telemetry!, 'sendEvent').mockImplementation(() => {});

    const el = await mount(ctxName);
    el.source = { id: 'my-src', label: 'my-label-key', onClick: () => {} };
    await el.updateComplete;

    el.activate();

    // The instance `use(TelemetryManager)` resolves is the same one the ctx's
    // container owns — proving the bag→use() migration kept a single instance.
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ payload: { sourceId: 'my-src' } });
  });

  it('activate() with no source set is a no-op (no telemetry, no crash)', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const telemetry = UploaderRegistry.get(ctxName)!.get(TelemetryManager);
    const spy = vi.spyOn(telemetry, 'sendEvent').mockImplementation(() => {});

    const el = await mount(ctxName);
    el.activate();

    expect(spy).not.toHaveBeenCalled();
  });
});
