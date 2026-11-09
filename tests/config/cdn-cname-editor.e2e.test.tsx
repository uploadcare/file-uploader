import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { Config } from '@/index';
import { IMAGE } from '~/tests/fixtures/files';
import { emulatorSession, isLive } from '~/tests/utils/emulator.browser';
import { renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * The image editor inside the uploader loads everything (image info, preview, filter thumbnails) from the file's
 * `cdnUrl`, which upload-client builds from `cdnCname` and `cdnCnamePrefixed`. Every CDN request it makes, and the URL
 * it applies, must stay on the CDN host those options resolve to.
 *
 * Fake-only (`describe.skipIf(isLive)`): the hosts are read from the emulator's request log, and a live run has none.
 */

/** Hosts that are not the CDN: the Upload API and telemetry. */
const NOT_CDN = new Set(['upload.uploadcare.com', 'tlm.uploadcare.com']);

const cdnHosts = () =>
  new Set(
    emulatorSession()
      .requests.map((request) => new URL(request.url).host)
      .filter((host) => !NOT_CDN.has(host)),
  );

const editFile = async (configProps: Partial<Config>, cdnCname: string) => {
  const { api, config, root } = await renderSolution('regular', {
    useCloudImageEditor: true,
    cloudImageEditorAutoOpen: true,
    ...configProps,
  });
  await expect.poll(() => config.cdnCname).toBe(cdnCname);

  api.addFileFromObject(IMAGE.SQUARE);
  api.initFlow();
  await expect.poll(() => api.getCurrentActivity(), { timeout: 20_000 }).toBe('cloud-image-edit');

  const editor = within(root);
  await userEvent.click(editor.getByRole('tab', { name: /filters/i }));
  // The first click on a filter applies it, so the applied URL carries an operation the editor built itself.
  const filter = editor.getByRole('option', { name: /^Apply (?!original).+ filter$/ }).first();
  await expect.element(filter, { timeout: 20_000 }).toBeVisible();
  const preview = filter.getByTestId('uc-editor-filter-control--preview');
  await expect
    .poll(() => (preview.query() as HTMLElement | null)?.style.backgroundImage ?? '', { timeout: 20_000 })
    .toContain(`url("${cdnCname}/`);
  await userEvent.click(filter);
  await userEvent.click(editor.getByRole('button', { name: 'Apply', exact: true }));

  await expect
    .poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrlModifiers ?? '', { timeout: 20_000 })
    .toContain('/filter/');
  return api.getOutputCollectionState().allEntries[0];
};

describe.skipIf(isLive)('the image editor stays on the configured CDN host', () => {
  it.each([
    ['the cdnCnamePrefixed zone', { cdnCnamePrefixed: 'https://m.ucarecd.net' }, 'https://1s4oyld5dc.m.ucarecd.net'],
    ['a custom cdnCname', { cdnCname: 'https://cdn.example.com' }, 'https://cdn.example.com'],
    ['the default zone', {}, 'https://1s4oyld5dc.ucarecd.net'],
  ] satisfies [string, Partial<Config>, string][])('on %s', async (_, configProps, cdnCname) => {
    const entry = await editFile(configProps, cdnCname);

    expect(entry.cdnUrl).toMatch(new RegExp(`^${cdnCname.replaceAll('.', '\\.')}/${entry.uuid}/-/`));
    expect([...cdnHosts()]).toEqual([new URL(cdnCname).host]);
    // The editor itself asked: its image info request is on the log.
    expect(emulatorSession().requests.some((request) => new URL(request.url).pathname.endsWith('/-/json/'))).toBe(true);
  });
});
