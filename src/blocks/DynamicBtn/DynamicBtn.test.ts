import { afterEach, describe, expect, it } from 'vitest';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
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

describe('DynamicBtn (M-god step 6b-2 migration)', () => {
  it('resolves its always-bound dependencies via @inject fields on the element', async () => {
    const ctxName = freshCtxName();
    const { el } = await mountWithConfig(ctxName);
    const container = UploaderRegistry.get(ctxName);
    expect(container).toBeDefined();

    // The always-bound controllers become `@inject` fields resolving through
    // the container the block adopted (tagged as `this[CONTAINER]`). The
    // uploader-scope-bound `UploadCollectionController` (read via
    // `whenController`/`use()`) and the trailing-tick `UploaderPublicApi` (read
    // via `useOrNull`) deliberately stay off `@inject` — an `@inject` field
    // would throw in the pre-scope / post-release windows those reads tolerate.
    const injected = el as unknown as {
      _config: ConfigController;
      _router: RouterController;
      _collectionState: CollectionStateController;
    };
    expect(injected._config).toBe(container?.get(ConfigController));
    expect(injected._router).toBe(container?.get(RouterController));
    expect(injected._collectionState).toBe(container?.get(CollectionStateController));
  });

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

  it('reactively updates the abort action progress via CollectionStateController.getTracked (no ctx.sub mirror)', async () => {
    const ctxName = freshCtxName();
    const { el } = await mountWithConfig(ctxName);
    const collectionState = UploaderRegistry.get(ctxName)?.get(CollectionStateController);
    if (!collectionState) throw new Error('collection-state controller not resolved');

    // `_status`/`_collection` are normally populated from
    // `bag.apiOrNull.getOutputCollectionState()` via the real
    // `observeProperties`/`observeCollection` wiring in `controllerReady` — set
    // directly here (same private-field-poke recipe as
    // UploadController.test.ts / ValidationController.test.ts) to reach the
    // `shouldShowAbortAction || hasCollectionEntries` render branch
    // (`_renderAbortAction`) without standing up a full upload-collection
    // instance. `_status`/`_collection` are Lit `@state` fields, so assigning
    // them schedules a render exactly as the real observer callback would.
    const target = el as unknown as {
      _status: 'idle' | 'success' | 'uploading' | 'failed';
      _collection: Entries;
    };
    target._status = 'uploading';
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
});
