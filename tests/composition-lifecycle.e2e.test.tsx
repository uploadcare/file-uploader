import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index';
import { delay } from '@/utils/delay';
import { IMAGE } from './fixtures/files';
import { recordEvents } from './utils/event-recorder';
import { inCtx, renderSolution } from './utils/render-solution';
import { getCtxName } from './utils/test-renderer';
import '../types/jsx';

/**
 * The documented composition model is several sibling tags wired by a shared `ctx-name`. These cover the orders and
 * lifecycles a real page can produce — config after the uploader, a tag appended late, two uploaders side by side,
 * an element removed and put back — none of which the existing suite exercised.
 */

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

/**
 * Mounts `<uc-config>` and a solution in an explicit DOM order, with attributes set imperatively.
 *
 * Not JSX, and the reason is a trap worth knowing before adding tests here: the generated JSX types declare boolean
 * options as `boolean`, so the documented attribute form (`multiple="false"`) does not typecheck — while
 * `multiple={false}`, which does, is dropped by render-jsx and silently leaves the option at its default. Build the
 * element by hand for the attribute route, or assign the DOM property after render (what `renderSolution`'s
 * `configProps` does) for the property route.
 */
const mount = async ({
  configFirst = false,
  attrs = {},
}: {
  configFirst?: boolean;
  attrs?: Record<string, string>;
}) => {
  const ctxName = getCtxName();

  const config = document.createElement('uc-config');
  config.setAttribute('ctx-name', ctxName);
  config.setAttribute('pubkey', 'demopublickey');
  config.setAttribute('test-mode', 'true');
  for (const [name, value] of Object.entries(attrs)) {
    config.setAttribute(name, value);
  }

  const uploader = document.createElement('uc-file-uploader-regular');
  uploader.setAttribute('ctx-name', ctxName);

  page.render(<div ctx-name={ctxName}></div>);
  inCtx('div', ctxName).append(...(configFirst ? [config, uploader] : [uploader, config]));
  await delay(50);

  return { ctxName, config: config as Config };
};

describe('tag order', () => {
  it('applies a config declared after the uploader', async () => {
    const { config } = await mount({ attrs: { multiple: 'false' } });
    expect(config.multiple).toBe(false);
  });

  it('applies a config declared before the uploader', async () => {
    const { config } = await mount({ configFirst: true, attrs: { multiple: 'false' } });
    expect(config.multiple).toBe(false);
  });

  it('picks up a provider appended after the uploader has settled', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    await delay(50);

    const provider = document.createElement('uc-upload-ctx-provider');
    provider.setAttribute('ctx-name', ctxName);
    inCtx('uc-config', ctxName).after(provider);
    await delay(0);

    const api = (provider as UploadCtxProvider).getAPI();
    const entry = api.addFileFromObject(IMAGE.PIXEL);
    expect(api.getOutputCollectionState().totalCount).toBe(1);
    expect(entry.internalId).toBeTruthy();
  });
});

describe('two uploaders on one page', () => {
  it('keeps collections and events apart when ctx-names differ', async () => {
    const first = await renderSolution();
    const second = await renderSolution();

    const firstEvents = recordEvents(first.provider);
    const secondEvents = recordEvents(second.provider);

    first.api.addFileFromObject(IMAGE.PIXEL, { fileName: 'first.jpg' });
    await delay(100);

    expect(first.api.getOutputCollectionState().totalCount).toBe(1);
    expect(second.api.getOutputCollectionState().totalCount).toBe(0);
    expect(firstEvents.detailsOf('file-added')).toHaveLength(1);
    expect(secondEvents.detailsOf('file-added')).toHaveLength(0);
  });

  it('keeps config apart when ctx-names differ', async () => {
    const first = await renderSolution('regular', { multiple: false });
    const second = await renderSolution();

    expect(first.config.multiple).toBe(false);
    expect(second.config.multiple).toBe(true);
  });

  it('shares one collection between two providers on the same ctx-name', async () => {
    const { ctxName, api } = await renderSolution();

    const sibling = document.createElement('uc-upload-ctx-provider');
    sibling.setAttribute('ctx-name', ctxName);
    inCtx('uc-upload-ctx-provider', ctxName).after(sibling);
    await delay(0);

    api.addFileFromObject(IMAGE.PIXEL);
    await delay(50);

    expect((sibling as UploadCtxProvider).getAPI().getOutputCollectionState().totalCount).toBe(1);
  });
});

describe('disconnect and reconnect', () => {
  it('keeps the collection when the uploader is moved within the same task', async () => {
    const { ctxName, api } = await renderSolution();
    api.addFileFromObject(IMAGE.PIXEL);
    await delay(50);

    const uploader = inCtx('uc-file-uploader-regular', ctxName);
    const parent = uploader.parentElement as HTMLElement;
    uploader.remove();
    parent.appendChild(uploader);
    await delay(50);

    expect(api.getOutputCollectionState().totalCount).toBe(1);
  });

  // QUIRK(lifecycle): the ctx is torn down in a `setTimeout(0)` once the last block disconnects
  // (LitBlock.ts:166), so whether state survives a remove/re-insert depends on whether a macrotask ran in between.
  // Moving a node synchronously keeps everything; the same move deferred by a tick silently starts from scratch.
  // Pinned as current behaviour, not endorsed.
  it('drops the collection when a macrotask passes between removal and re-insertion', async () => {
    const { ctxName, api } = await renderSolution();
    api.addFileFromObject(IMAGE.PIXEL);
    await delay(50);

    const uploader = inCtx('uc-file-uploader-regular', ctxName);
    const provider = inCtx('uc-upload-ctx-provider', ctxName);
    const config = inCtx('uc-config', ctxName);
    const parent = uploader.parentElement as HTMLElement;

    for (const element of [uploader, provider, config]) {
      element.remove();
    }
    await delay(50);
    for (const element of [config, uploader, provider]) {
      parent.appendChild(element);
    }
    await delay(50);

    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });
});

describe('config values set after render', () => {
  it('takes a JS property that overrides the declared attribute', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config
          qualityInsights={false}
          ctx-name={ctxName}
          pubkey="demopublickey"
          testMode
          multipleMax={3}
        ></uc-config>
      </>,
    );
    await delay(0);

    const config = inCtx<Config>('uc-config', ctxName);
    expect(config.multipleMax).toBe(3);

    config.multipleMax = 7;
    await delay(0);
    expect(config.multipleMax).toBe(7);
  });

  it('falls back to the default when a string option is cleared', async () => {
    const { config } = await renderSolution('regular', { accept: 'image/png' });
    expect(config.accept).toBe('image/png');

    config.accept = '';
    await delay(0);
    expect(config.accept).toBe('');
  });
});

describe('documented attribute conventions', () => {
  const renderConfig = async (attrs: Record<string, string>) => (await mount({ attrs })).config;

  // configuration.mdx, "How to define attributes".
  it('reads `true` as true', async () => {
    expect((await renderConfig({ 'img-only': 'true' })).imgOnly).toBe(true);
  });

  it('reads an empty value as true', async () => {
    expect((await renderConfig({ 'img-only': '' })).imgOnly).toBe(true);
  });

  it('reads `false` as false', async () => {
    expect((await renderConfig({ 'img-only': 'false' })).imgOnly).toBe(false);
  });

  it('accepts both kebab-case and camelCase', async () => {
    expect((await renderConfig({ imgOnly: 'true' })).imgOnly).toBe(true);
  });

  // QUIRK(config): configuration.mdx says "any other thruthy value means `true`
  // (e.g. <uc-config this-is-boolean="value">)", but asBoolean throws `Invalid boolean: "value"` for anything that is
  // not `true`, `false` or an empty string (Config/validatorsType.ts:19). The option keeps its default instead of
  // becoming true, and the error surfaces on the console. Pinned as current behaviour, not endorsed — the docs and
  // the code disagree and only a human can say which one is right.
  it('does not follow the documented "any truthy value" rule', async () => {
    const config = await renderConfig({ 'img-only': 'value' });
    expect(config.imgOnly).toBe(false);
  });
});
