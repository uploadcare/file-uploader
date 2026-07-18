import { afterEach, describe, expect, it } from 'vitest';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import type { OutputCollectionState } from '../../types/index';
import { delay } from '../../utils/delay';
import { FormInput } from './FormInput';

// Idempotent (same path as defineComponents(UC)).
FormInput.reg('uc-form-input');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `form-input-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mount = async (
  ctxName: string,
  attrs: Record<string, string> = {},
): Promise<{ el: FormInput; config: ConfigController; collection: CollectionStateController }> => {
  ensureUploaderCtx(ctxName);
  const container = PubSub.getContainer(ctxName);
  const config = container?.get(ConfigController);
  const collection = container?.get(CollectionStateController);
  if (!config || !collection) throw new Error('controllers not resolved');
  const el = document.createElement('uc-form-input') as FormInput;
  el.setAttribute('ctx-name', ctxName);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  return { el, config, collection };
};

// Minimal mock of the large `OutputCollectionState` discriminated union — only
// the fields FormInput reads (`status`/`errors`/`group`/`allEntries`) matter.
type TestState = {
  status: OutputCollectionState['status'];
  errors: { message?: string }[];
  group: { cdnUrl?: string } | null;
  allEntries: { cdnUrl?: string }[];
};

const setState = async (el: FormInput, collection: CollectionStateController, state: TestState): Promise<void> => {
  collection.set('collectionState', state as unknown as OutputCollectionState);
  await el.updateComplete;
  await delay(0);
};

const validationInput = (el: FormInput): HTMLInputElement | null => el.querySelector('input[type="text"]');
const hiddenInputs = (el: FormInput): HTMLInputElement[] =>
  Array.from(el.querySelectorAll<HTMLInputElement>('input[type="hidden"]'));

describe('FormInput (M-god step 6b-4 migration)', () => {
  it('declares its dependencies via static uses', () => {
    expect(FormInput.uses).toEqual([ConfigController, CollectionStateController]);
  });

  it('creates the validation input on ready, reflecting multipleMin via ConfigController', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    PubSub.getContainer(ctxName)!.get(ConfigController).set('multipleMin', 2);
    const { el } = await mount(ctxName);
    const input = validationInput(el);
    expect(input).not.toBeNull();
    expect(input?.required).toBe(true);
    expect(input?.name).toBe(ctxName);
  });

  it('leaves the validation input optional when multipleMin is 0', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    expect(validationInput(el)?.required).toBe(false);
  });

  it('clears the value while uploading (reactive collectionState read, no ctx.sub)', async () => {
    const ctxName = freshCtxName();
    const { el, collection } = await mount(ctxName);
    await setState(el, collection, { status: 'uploading', errors: [], group: null, allEntries: [] });
    const input = validationInput(el);
    expect(input?.value).toBe('');
    expect(hiddenInputs(el)).toHaveLength(0);
  });

  it('sets the validation message on a failed collection', async () => {
    const ctxName = freshCtxName();
    const { el, collection } = await mount(ctxName);
    await setState(el, collection, {
      status: 'failed',
      errors: [{ message: 'boom' }],
      group: null,
      allEntries: [],
    });
    expect(validationInput(el)?.validationMessage).toBe('boom');
  });

  it('writes the single cdnUrl into the validation input when not multiple', async () => {
    const ctxName = freshCtxName();
    const { el, config, collection } = await mount(ctxName);
    config.set('multiple', false);
    await setState(el, collection, {
      status: 'success',
      errors: [],
      group: null,
      allEntries: [{ cdnUrl: 'https://cdn/one' }],
    });
    expect(validationInput(el)?.value).toBe('https://cdn/one');
    expect(hiddenInputs(el)).toHaveLength(0);
  });

  it('regenerates hidden inputs[] when multiple and re-renders on a later collectionState change', async () => {
    const ctxName = freshCtxName();
    const { el, config, collection } = await mount(ctxName);
    config.set('multiple', true);
    await setState(el, collection, {
      status: 'success',
      errors: [],
      group: null,
      allEntries: [{ cdnUrl: 'https://cdn/a' }, { cdnUrl: 'https://cdn/b' }],
    });
    let hidden = hiddenInputs(el);
    expect(hidden.map((i) => i.value)).toEqual(['https://cdn/a', 'https://cdn/b']);
    expect(hidden.every((i) => i.name === `${ctxName}[]`)).toBe(true);
    // The validation input is removed on the multi path so it isn't submitted.
    expect(validationInput(el)).toBeNull();

    // A new collection state re-runs the reactive rebuild.
    await setState(el, collection, {
      status: 'success',
      errors: [],
      group: null,
      allEntries: [{ cdnUrl: 'https://cdn/c' }],
    });
    hidden = hiddenInputs(el);
    expect(hidden.map((i) => i.value)).toEqual(['https://cdn/c']);
  });

  it('uses the group cdnUrl when the collection has a group', async () => {
    const ctxName = freshCtxName();
    const { el, collection } = await mount(ctxName);
    await setState(el, collection, {
      status: 'success',
      errors: [],
      group: { cdnUrl: 'https://cdn/group' },
      allEntries: [{ cdnUrl: 'https://cdn/a' }],
    });
    expect(validationInput(el)?.value).toBe('https://cdn/group');
  });
});
