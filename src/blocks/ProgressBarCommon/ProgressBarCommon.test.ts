import { afterEach, describe, expect, it } from 'vitest';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import { delay } from '../../utils/delay';
import type { ProgressBar } from '../ProgressBar/ProgressBar';
import { ProgressBarCommon } from './ProgressBarCommon';

// Idempotent (same path as defineComponents(UC)).
ProgressBarCommon.reg('uc-progress-bar-common');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `progress-bar-common-spec-${seq++}`;
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
): Promise<{ el: ProgressBarCommon; collectionState: CollectionStateController }> => {
  ensureUploaderCtx(ctxName);
  const collectionState = PubSub.getContainer(ctxName)?.get(CollectionStateController);
  if (!collectionState) throw new Error('collection-state controller not resolved');
  const el = document.createElement('uc-progress-bar-common') as ProgressBarCommon;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, collectionState };
};

const innerValue = (el: ProgressBarCommon): number | undefined =>
  (el.querySelector('uc-progress-bar') as ProgressBar | null)?.value;

describe('ProgressBarCommon (M-god step 6b-2 migration)', () => {
  it('declares its dependency via static uses', () => {
    expect(ProgressBarCommon.uses).toEqual([CollectionStateController]);
  });

  it('re-renders the inner progress-bar value reactively when commonProgress changes (getTracked, no ctx.sub)', async () => {
    const ctxName = freshCtxName();
    const { el, collectionState } = await mount(ctxName);
    expect(innerValue(el)).toBe(0);

    // External collection-state change — no imperative `ctx.sub('*commonProgress')`
    // on the block. The tracked `commonProgress` read in render() re-renders.
    collectionState.set('commonProgress', 42);
    await el.updateComplete;
    await delay(0);
    expect(innerValue(el)).toBe(42);

    collectionState.set('commonProgress', 100);
    await el.updateComplete;
    await delay(0);
    expect(innerValue(el)).toBe(100);
  });
});
