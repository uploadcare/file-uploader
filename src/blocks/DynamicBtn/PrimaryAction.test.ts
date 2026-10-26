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

describe('PrimaryAction', () => {
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

  it('takes source and entries as properties only, ignoring same-named attributes', async () => {
    const { el } = await mountWithConfig(freshCtxName());
    expect(el.source).toBeNull();
    const entries = makeEntries({ status: 'success', isSuccess: true, totalCount: 1, allEntries: [{}] });
    el.entries = entries;
    await el.updateComplete;

    el.setAttribute('entries', 'not json');
    el.setAttribute('source', '{"id":"url","label":"src-type-from-url"}');
    await el.updateComplete;

    expect(el.entries).toBe(entries);
    expect(el.source).toBeNull();
  });
});

describe('PrimaryAction header text', () => {
  type Counts = { uploading?: number; failed?: number; success?: number; idle?: number; validating?: number };
  const entriesWith = ({ uploading = 0, failed = 0, success = 0, idle = 0, validating = 0 }: Counts): Entries => {
    const idleEntries = [
      ...Array.from({ length: idle }, () => ({ isValidationPending: false })),
      ...Array.from({ length: validating }, () => ({ isValidationPending: true })),
    ];
    const totalCount = uploading + failed + success + idleEntries.length;
    const status = failed
      ? 'failed'
      : uploading
        ? 'uploading'
        : success === totalCount && totalCount
          ? 'success'
          : 'idle';
    return {
      status,
      isSuccess: status === 'success',
      totalCount,
      uploadingCount: uploading,
      failedCount: failed,
      successCount: success,
      idleEntries,
      allEntries: Array.from({ length: totalCount }, () => ({})),
    } as unknown as Entries;
  };

  it.each<[string, Counts, string]>([
    ['uploading', { uploading: 1 }, 'Uploading 1 file'],
    ['uploading while another failed', { uploading: 1, failed: 1 }, 'Uploading 1 file'],
    ['validating before upload', { validating: 1, idle: 1 }, 'Uploading 1 file'],
    ['failed', { failed: 2, success: 1 }, '2 errors'],
    ['all uploaded', { success: 2 }, '2 files uploaded'],
    ['some uploaded, some not started', { success: 1, idle: 1 }, '1 file uploaded'],
    ['none started', { idle: 2 }, '2 files selected'],
  ])('reports %s', async (_, counts, text) => {
    const { el } = await mountWithConfig(freshCtxName());
    el.entries = entriesWith(counts);
    await el.updateComplete;

    expect(el.querySelector('button')?.getAttribute('aria-label')).toBe(text);
  });
});

describe('PrimaryAction mobile camera label', () => {
  it.each([
    ['mobile-photo-camera', 'Take snapshot'],
    ['mobile-video-camera', 'Record clip'],
  ] as const)('names the %s source in the current locale', async (id, text) => {
    const { el, config } = await mountWithConfig(freshCtxName());
    config.set('localeDefinitionOverride', {
      en: { 'src-type-mobile-photo-camera': 'Snapshot', 'src-type-mobile-video-camera': 'Clip' },
    });
    el.source = { id, label: `src-type-${id}`, icon: 'camera', onClick: () => {} };
    await el.updateComplete;

    expect(el.querySelector('button')?.getAttribute('aria-label')).toBe(text);
  });
});
