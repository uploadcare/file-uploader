import { afterEach, describe, expect, it } from 'vitest';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import type { OutputCollectionState, OutputCollectionStatus } from '../../types';
import { delay } from '../../utils/delay';
import type { FileActionButton } from '../FileItem/FileActionButton';
import { DynamicBtn } from './DynamicBtn';

type Entries = OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'>;

// Same narrow-cast fixture recipe as PrimaryAction.test.ts / tests/blocks/primary-action.e2e.test.tsx:
// only `status`/`allEntries` are read on the paths these tests exercise.
const makeEntries = (
  partial: Partial<Pick<Entries, 'status' | 'totalCount'>> & {
    allEntries?: Array<Partial<Entries['allEntries'][number]>>;
  },
): Entries => partial as Entries;

// Idempotent (same path as defineComponents(UC)).
DynamicBtn.reg('uc-dynamic-btn');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `dynamic-btn-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mountWithConfig = async (ctxName: string): Promise<{ el: DynamicBtn; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-dynamic-btn') as DynamicBtn;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

const hasPrimaryAction = (el: DynamicBtn): boolean => el.querySelector('uc-primary-action') !== null;

describe('DynamicBtn', () => {
  it('re-renders reactively when config.dynamicButtonViewMode changes (getTracked, no subConfigValue)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mountWithConfig(ctxName);

    // Idle, no entries: `auto` mode always shows the primary action; `compact`
    // mode never does. Switching the config re-renders through the tracked
    // `_mode` read with no imperative `subConfigValue` subscription.
    config.set('dynamicButtonViewMode', 'auto');
    await el.updateComplete;
    await delay(0);
    expect(hasPrimaryAction(el)).toBe(true);

    config.set('dynamicButtonViewMode', 'compact');
    await el.updateComplete;
    await delay(0);
    expect(hasPrimaryAction(el)).toBe(false);

    // Bidirectional.
    config.set('dynamicButtonViewMode', 'auto');
    await el.updateComplete;
    await delay(0);
    expect(hasPrimaryAction(el)).toBe(true);
  });

  it('drops a hidden primary action instead of keeping it detached for reuse', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mountWithConfig(ctxName);
    const setMode = async (mode: 'auto' | 'compact') => {
      config.set('dynamicButtonViewMode', mode);
      await el.updateComplete;
      await delay(0);
    };

    await setMode('auto');
    const first = el.querySelector('uc-primary-action');
    expect(first).not.toBeNull();

    await setMode('compact');
    await setMode('auto');
    const second = el.querySelector('uc-primary-action');
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it('reactively updates the abort action progress via CollectionStateController.getTracked (no ctx.sub mirror)', async () => {
    const ctxName = freshCtxName();
    const { el } = await mountWithConfig(ctxName);
    const collectionState = UploaderRegistry.get(ctxName)?.get(CollectionStateController);
    if (!collectionState) throw new Error('collection-state controller not resolved');

    // `_collection` (the status derives from it) is normally populated from
    // `getOutputCollectionState()` by the collection observers — set directly
    // here to reach the `_renderAbortAction` branch without standing up a full
    // upload collection. It is a Lit `@state` field, so assigning it schedules a
    // render exactly as the real observer callback would.
    const target = el as unknown as { _collection: Entries };
    target._collection = makeEntries({ status: 'uploading', totalCount: 1, allEntries: [{}] });
    await el.updateComplete;
    await delay(0);

    const abortAction = el.querySelector('uc-file-action-button') as FileActionButton | null;
    expect(abortAction).not.toBeNull();
    expect(abortAction?.progress).toBe(0);

    // `_progress` (read inside `_renderAbortAction`) is a tracked
    // `CollectionStateController.getTracked('commonProgress')` read — no
    // imperative `ctx.sub('*commonProgress')` mirror — so an external
    // `set()` re-renders it reactively.
    collectionState.set('commonProgress', 42);
    await el.updateComplete;
    await delay(0);
    expect(abortAction?.progress).toBe(42);

    collectionState.set('commonProgress', 100);
    await el.updateComplete;
    await delay(0);
    expect(abortAction?.progress).toBe(100);
  });

  it('turns its dropzone off with dropzone="false"', async () => {
    const { el } = await mountWithConfig(freshCtxName());
    el.setAttribute('dropzone', 'false');
    await el.updateComplete;
    expect(el.dropzone).toBe(false);
    expect(el.querySelector('uc-drop-area')?.disabled).toBe(true);
  });
});
