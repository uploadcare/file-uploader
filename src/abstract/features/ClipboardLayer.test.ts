import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { PubSub } from '../../lit/PubSubCompat';
import type { SharedState } from '../../lit/SharedState';
import { createSharedInstancesBag } from '../../lit/shared-instances';
import { sharedConfigKey } from '../sharedConfigKey';
import { ClipboardLayer, type PasteScope } from './ClipboardLayer';

/** Accepted pastes land in order, so one of this after the paste under test shows that paste was handled. */
const SENTINEL_URL = 'https://example.com/sentinel.jpg';

/**
 * A clipboard layer with one registered scope element on the page. `added` lists what reached the public API: files by
 * name, urls as they are.
 */
const setup = ({
  pasteScope = 'local',
  currentActivity = 'upload-list',
  scopeTag = 'div',
}: {
  pasteScope?: PasteScope;
  currentActivity?: string | null;
  scopeTag?: string;
} = {}) => {
  const added: string[] = [];
  const ctxName = 'clipboard-layer';
  const ctx = PubSub.registerCtx<Record<string, unknown>>(
    {
      '*currentActivity': currentActivity,
      [sharedConfigKey('pasteScope')]: pasteScope,
      '*publicApi': {
        addFileFromObject: (file: File) => added.push(file.name),
        addFileFromUrl: (url: string) => added.push(url),
      },
      '*routerLayer': { navigateAfterFileAdd: () => {} },
    },
    ctxName,
  ) as unknown as PubSub<SharedState>;
  const layer = new ClipboardLayer(createSharedInstancesBag(() => ctx));
  const scope = document.createElement(scopeTag);
  document.body.append(scope);
  layer.registerBlock(scope);
  onTestFinished(() => {
    layer.destroy();
    scope.remove();
    PubSub.deleteCtx(ctxName);
  });
  return { added, scope, ctx };
};

type Item = File | { text: string; type?: string };

const paste = (target: EventTarget, ...items: Item[]) => {
  const data = new DataTransfer();
  for (const item of items) {
    if (item instanceof File) data.items.add(item);
    else data.items.add(item.text, item.type ?? 'text/plain');
  }
  target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, composed: true }));
};

/** Pastes the sentinel into `scope` and answers everything added once it has landed. */
const addedThroughSentinel = async ({ added, scope }: ReturnType<typeof setup>) => {
  paste(scope, { text: SENTINEL_URL });
  await vi.waitFor(() => expect(added).toContain(SENTINEL_URL));
  return added;
};

describe('ClipboardLayer', () => {
  describe('pasted text', () => {
    it.each([
      ['an http url', 'http://example.com/photo.jpg', 'text/plain', 'http://example.com/photo.jpg'],
      ['an https url', 'https://example.com/photo.jpg', 'text/plain', 'https://example.com/photo.jpg'],
      ['a url as text/uri-list', 'https://example.com/photo.jpg', 'text/uri-list', 'https://example.com/photo.jpg'],
    ])('adds %s', async (_name, text, type, url) => {
      const layer = setup();

      paste(layer.scope, { text, type });

      expect(await addedThroughSentinel(layer)).toEqual([url, SENTINEL_URL]);
    });

    it.each([
      ['plain text', 'just some words', 'text/plain'],
      ['an ftp url', 'ftp://example.com/photo.jpg', 'text/plain'],
      ['a javascript: url', 'javascript:alert(1)', 'text/plain'],
      ['a data: url', 'data:image/png;base64,AAAA', 'text/plain'],
      ['whitespace', '   ', 'text/plain'],
      ['html', '<a href="https://example.com/photo.jpg">photo</a>', 'text/html'],
    ])('ignores %s', async (_name, text, type) => {
      const layer = setup();

      paste(layer.scope, { text, type });

      expect(await addedThroughSentinel(layer)).toEqual([SENTINEL_URL]);
    });

    it('takes both a file and a url from one paste', async () => {
      const layer = setup();

      paste(layer.scope, new File(['x'], 'pasted.png', { type: 'image/png' }), {
        text: 'https://example.com/photo.jpg',
      });

      expect(await addedThroughSentinel(layer)).toEqual(['pasted.png', 'https://example.com/photo.jpg', SENTINEL_URL]);
    });
  });

  describe('editable targets', () => {
    it.each([
      ['an input', '<input />'],
      ['a textarea', '<textarea></textarea>'],
      ['a select', '<select></select>'],
      ['a contenteditable element', '<div contenteditable></div>'],
      ['a role=textbox element', '<div role="textbox"></div>'],
      ['a role=searchbox element', '<div role="searchbox"></div>'],
      ['a role=combobox element', '<div role="combobox"></div>'],
    ])('ignores a paste into %s', async (_name, html) => {
      const layer = setup();
      layer.scope.innerHTML = html;

      paste(layer.scope.firstElementChild as Element, { text: 'https://example.com/photo.jpg' });

      expect(await addedThroughSentinel(layer)).toEqual([SENTINEL_URL]);
    });

    it('accepts a paste into contenteditable="false"', async () => {
      const layer = setup();
      layer.scope.innerHTML = '<div contenteditable="false"></div>';

      paste(layer.scope.firstElementChild as Element, { text: 'https://example.com/photo.jpg' });

      expect(await addedThroughSentinel(layer)).toEqual(['https://example.com/photo.jpg', SENTINEL_URL]);
    });
  });

  describe('pasteScope', () => {
    it("ignores a paste outside the scope on 'local'", async () => {
      const layer = setup({ pasteScope: 'local' });

      paste(document.body, { text: 'https://example.com/photo.jpg' });

      expect(await addedThroughSentinel(layer)).toEqual([SENTINEL_URL]);
    });

    it("accepts a paste anywhere on 'global'", async () => {
      const layer = setup({ pasteScope: 'global' });

      paste(document.body, { text: 'https://example.com/photo.jpg' });

      expect(await addedThroughSentinel(layer)).toEqual(['https://example.com/photo.jpg', SENTINEL_URL]);
    });

    it("accepts a paste inside the scope before any activity on 'local'", async () => {
      const layer = setup({ pasteScope: 'local', currentActivity: null });

      paste(layer.scope, { text: 'https://example.com/photo.jpg' });

      expect(await addedThroughSentinel(layer)).toEqual(['https://example.com/photo.jpg', SENTINEL_URL]);
    });
  });

  it.each([
    'local',
    'global',
  ] as const)("ignores a paste on '%s' while another activity is open", async (pasteScope) => {
    const layer = setup({ pasteScope, currentActivity: 'camera' });

    paste(layer.scope, { text: 'https://example.com/photo.jpg' });
    layer.ctx.pub('*currentActivity', 'upload-list');

    expect(await addedThroughSentinel(layer)).toEqual([SENTINEL_URL]);
  });

  describe("'global' before any activity", () => {
    it('accepts a paste when the regular solution is on the page', async () => {
      const layer = setup({ pasteScope: 'global', currentActivity: null, scopeTag: 'uc-file-uploader-regular' });

      paste(document.body, { text: 'https://example.com/photo.jpg' });

      expect(await addedThroughSentinel(layer)).toEqual(['https://example.com/photo.jpg', SENTINEL_URL]);
    });

    it('ignores a paste when only another solution is', async () => {
      const layer = setup({ pasteScope: 'global', currentActivity: null, scopeTag: 'uc-file-uploader-inline' });

      paste(document.body, { text: 'https://example.com/photo.jpg' });
      layer.ctx.pub('*currentActivity', 'upload-list');

      expect(await addedThroughSentinel(layer)).toEqual([SENTINEL_URL]);
    });
  });
});
