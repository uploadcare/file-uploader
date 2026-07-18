import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import type { IconHrefResolver } from '../../types/index';
import { delay } from '../../utils/delay';
import { Icon } from './Icon';

// Idempotent (same path as defineComponents(UC)).
Icon.reg('uc-icon');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `icon-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mountWithConfig = async (ctxName: string, name: string): Promise<{ el: Icon; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = PubSub.getContainer(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-icon') as Icon;
  el.setAttribute('ctx-name', ctxName);
  el.name = name;
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

const useHref = (el: Icon): string | null | undefined => el.querySelector('svg use')?.getAttribute('href');

describe('Icon (M-god step 6b-2 migration)', () => {
  it('declares its dependency via static uses', () => {
    expect(Icon.uses).toEqual([ConfigController]);
  });

  it('renders the default sprite href for a name with no custom resolver', async () => {
    const { el } = await mountWithConfig(freshCtxName(), 'upload');
    expect(useHref(el)).toBe('#uc-icon-upload');
  });

  it('re-renders the resolved href reactively when config.iconHrefResolver changes (getTracked, no subConfigValue)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mountWithConfig(ctxName, 'upload');
    expect(useHref(el)).toBe('#uc-icon-upload');

    // External config change — no imperative subscription on the block. The
    // `iconHrefResolver` read in render() was tracked by SignalWatcher, so this
    // re-renders with the resolver's href.
    const resolver: IconHrefResolver = (name) => `https://cdn.example/${name}.svg`;
    config.set('iconHrefResolver', resolver);
    await el.updateComplete;
    await delay(0);
    expect(useHref(el)).toBe('https://cdn.example/upload.svg');

    // And back to the default when the resolver is cleared — bidirectional.
    config.set('iconHrefResolver', null);
    await el.updateComplete;
    await delay(0);
    expect(useHref(el)).toBe('#uc-icon-upload');
  });
});
