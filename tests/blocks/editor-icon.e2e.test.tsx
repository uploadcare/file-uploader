import { EDITOR_IMAGE_UUID } from '@uploadcare/api-emulator';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { UploaderPlugin } from '@/index';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import { createInCtx, inCtx, renderSolution, within } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

const UPLOAD = { timeout: 10000 };

const editorIconHrefs = (root: Element) =>
  [...root.querySelectorAll('uc-cloud-image-editor uc-editor-icon svg use')].map((use) => use.getAttribute('href'));

const openEditor = async (config: Parameters<typeof renderSolution>[1]) => {
  const { api, root } = await renderSolution('regular', {
    useCloudImageEditor: true,
    cloudImageEditorAutoOpen: true,
    ...config,
  });
  api.addFileFromUrl(TEST_IMAGE_URL);
  api.initFlow();
  await expect.element(within(root).getByTestId('uc-cloud-image-editor'), UPLOAD).toBeVisible();
  return root;
};

describe('uc-editor-icon', () => {
  it('resolves its href through iconHrefResolver when the editor runs inside the uploader', async () => {
    const root = await openEditor({ iconHrefResolver: (name: string) => `/custom.svg#my-${name}` });

    await expect.poll(() => editorIconHrefs(root)).toContain('/custom.svg#my-rotate');
    expect(editorIconHrefs(root).every((href) => href?.startsWith('/custom.svg#my-'))).toBe(true);
  });

  it('renders a plugin-registered icon inline when the editor runs inside the uploader', async () => {
    const plugin: UploaderPlugin = {
      id: 'editor-icon-test-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerIcon({
          name: 'rotate',
          svg: '<svg viewBox="0 0 24 24" class="plugin-rotate"><rect width="24" height="24"/></svg>',
        });
      },
    };
    const root = await openEditor({ plugins: [plugin] });

    await expect
      .poll(() => root.querySelector('uc-cloud-image-editor uc-editor-icon[name="rotate"] svg.plugin-rotate'))
      .toBeTruthy();
    expect(editorIconHrefs(root)).not.toContain('#uc-icon-rotate');
  });

  it('keeps the built-in sprite in the standalone editor', async () => {
    // Decision, not a quirk: v1's standalone editor rendered `uc-icon` and followed a sibling `<uc-config>`'s
    // `iconHrefResolver`; for 1.x the standalone editor keeps its built-in sprite (see NEXT-MAJOR(editor-icons)).
    const ctxName = getCtxName();
    const element = createInCtx('uc-cloud-image-editor', ctxName, { uuid: EDITOR_IMAGE_UUID });
    const config = createInCtx('uc-config', ctxName, { pubkey: 'demopublickey', 'test-mode': 'true' });
    Object.assign(config, { iconHrefResolver: (name: string) => `/custom.svg#my-${name}` });
    page.render(<div ctx-name={ctxName}></div>);
    inCtx('div', ctxName).append(element, config);

    await expect.poll(() => editorIconHrefs(inCtx('div', ctxName))).toContain('#uc-icon-rotate');
    expect(editorIconHrefs(inCtx('div', ctxName)).every((href) => href?.startsWith('#uc-icon-'))).toBe(true);
  });
});
