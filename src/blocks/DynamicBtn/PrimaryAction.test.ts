import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import type { OutputCollectionState, OutputCollectionStatus } from '../../types';
import { delay } from '../../utils/delay';
import { PrimaryAction } from './PrimaryAction';

// Idempotent (same path as defineComponents(UC)).
PrimaryAction.reg('uc-primary-action');

type Entries = OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'>;

// Same narrow-cast fixture recipe as tests/blocks/primary-action.e2e.test.tsx:
// PrimaryAction only reads a subset of the collection-state fields.
const makeEntries = (
  partial: Partial<Pick<Entries, 'status' | 'totalCount' | 'isSuccess'>> & {
    allEntries?: Array<Partial<Entries['allEntries'][number]>>;
  },
): Entries => partial as Entries;

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `primary-action-spec-${seq++}`;
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

const mountWithConfig = async (ctxName: string): Promise<{ el: PrimaryAction; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-primary-action') as PrimaryAction;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

const iconEl = (el: PrimaryAction): Element | null => el.querySelector('uc-icon');

describe('PrimaryAction (M-god step 6b-1 migration)', () => {
  it('resolves its ConfigController + RouterController dependencies via @inject fields on the element', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mountWithConfig(ctxName);
    const router = UploaderRegistry.get(ctxName)?.get(RouterController);
    expect(router).toBeDefined();

    // The `@inject` fields resolve through the container the block adopted
    // (tagged as `this[CONTAINER]`), yielding the very same instances the ctx
    // owns — the mechanism that replaces `static uses` + `this.use()`.
    const injected = el as unknown as { _config: ConfigController; _router: RouterController };
    expect(injected._config).toBe(config);
    expect(injected._router).toBe(router);
  });

  it('renders/hides the source icon reactively when dynamicButtonShowFirstIcon toggles (getTracked)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mountWithConfig(ctxName);
    config.set('dynamicButtonShowFirstIcon', false);
    el.source = { id: 'local', label: 'src-type-local', icon: 'my-icon', onClick: () => {} };
    el.entries = makeEntries({ totalCount: 0, allEntries: [] });
    await el.updateComplete;
    await delay(0);
    expect(iconEl(el)).toBeNull();

    // External config change re-renders with no subConfigValue subscription.
    config.set('dynamicButtonShowFirstIcon', true);
    await el.updateComplete;
    await delay(0);
    expect(iconEl(el)).not.toBeNull();

    config.set('dynamicButtonShowFirstIcon', false);
    await el.updateComplete;
    await delay(0);
    expect(iconEl(el)).toBeNull();
  });

  it('navigates via the container-resolved RouterController (use()) when entries are present', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const router = UploaderRegistry.get(ctxName)!.get(RouterController);
    const spy = vi.spyOn(router, 'navigate').mockImplementation(() => {});

    const { el } = await mountWithConfig(ctxName);
    el.source = { id: 'local', label: 'src-type-local', onClick: () => {} };
    el.entries = makeEntries({ status: 'success', isSuccess: true, totalCount: 1, allEntries: [{}] });
    await el.updateComplete;

    (el.querySelector('button') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith('upload-list');
  });
});
