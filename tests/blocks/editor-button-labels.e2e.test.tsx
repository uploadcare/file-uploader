import { EDITOR_IMAGE_UUID } from '@uploadcare/api-emulator';
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '~/types/jsx';
import { defineLocale } from '@/index';
import de from '@/locales/file-uploader/de';
import { createInCtx, inCtx, within } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';

defineLocale('de', de);

const CONTROLS = [
  'uc-editor-crop-button-control',
  'uc-editor-freeform-button-control',
  'uc-editor-aspect-ratio-button-control',
  'uc-editor-operation-control',
  'uc-editor-filter-control',
].join(',');

const renderEditor = (cropPreset: string) => {
  const ctxName = getCtxName();
  const element = createInCtx<HTMLElement>('uc-cloud-image-editor', ctxName, {
    'crop-preset': cropPreset,
    uuid: EDITOR_IMAGE_UUID,
  });
  const config = createInCtx('uc-config', ctxName, {
    'cdn-cname': 'https://ucarecdn.com/',
    'quality-insights': 'false',
    pubkey: 'demopublickey',
    'test-mode': 'true',
  });
  page.render(<div ctx-name={ctxName}></div>);
  inCtx('div', ctxName).append(element, config);
  return { element, config, editor: within(element) };
};

/** What each visible button says: its tag, accessible name, tooltip, visible text, icon and host state. */
const describeControls = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>(CONTROLS)]
    .filter((control) => control.checkVisibility())
    .map((control) => {
      const button = control.querySelector('button');
      return [
        control.tagName.toLowerCase().replace('uc-editor-', ''),
        `aria-label=${button?.getAttribute('aria-label') ?? '∅'}`,
        `title=${button?.getAttribute('title') ?? '∅'}`,
        `text=${control.querySelector<HTMLElement>('.uc-title:not([hidden])')?.textContent?.trim() ?? '∅'}`,
        `icon=${control.querySelector('uc-editor-icon')?.getAttribute('name') ?? (control.querySelector('svg') ? 'svg' : '∅')}`,
        control.classList.contains('uc-active') ? 'active' : 'inactive',
        control.hasAttribute('uc-aspect-ratio-freeform') ? 'freeform' : '',
      ]
        .filter(Boolean)
        .join(' ');
    });

describe('editor button labels', () => {
  it('labels the crop tab controls and the preset list', async () => {
    const { element, editor } = renderEditor('free, 1:1, 16:9');
    await expect.element(editor.getByRole('option', { name: 'Freeform crop', exact: true })).toBeVisible();

    expect(describeControls(element)).toMatchInlineSnapshot(`
      [
        "freeform-button-control aria-label=Freeform crop title=Freeform crop text=Freeform crop icon=arrow-dropdown inactive",
        "crop-button-control aria-label=Apply rotate operation title=Apply rotate operation text=∅ icon=rotate inactive",
        "crop-button-control aria-label=Apply mirror operation title=Apply mirror operation text=∅ icon=mirror inactive",
        "crop-button-control aria-label=Apply flip operation title=Apply flip operation text=∅ icon=flip inactive",
      ]
    `);

    await userEvent.click(editor.getByRole('option', { name: 'Freeform crop', exact: true }));
    await expect.element(editor.getByRole('option', { name: /16:9/ })).toBeVisible();

    expect(describeControls(element)).toMatchInlineSnapshot(`
      [
        "freeform-button-control aria-label=Freeform crop title=Freeform crop text=Freeform crop icon=arrow-dropdown inactive",
        "crop-button-control aria-label=Apply rotate operation title=Apply rotate operation text=∅ icon=rotate inactive",
        "crop-button-control aria-label=Apply mirror operation title=Apply mirror operation text=∅ icon=mirror inactive",
        "crop-button-control aria-label=Apply flip operation title=Apply flip operation text=∅ icon=flip inactive",
        "aspect-ratio-button-control aria-label=Apply operation freeform  title=Apply operation freeform  text=Freeform icon= active freeform",
        "aspect-ratio-button-control aria-label=Apply operation crop to 1:1  title=Apply operation crop to 1:1  text=1:1 icon=svg inactive",
        "aspect-ratio-button-control aria-label=Apply operation crop to 16:9  title=Apply operation crop to 16:9  text=16:9 icon=svg inactive",
      ]
    `);
  });

  it('labels the tuning controls', async () => {
    const { element, editor } = renderEditor('1:1');
    await userEvent.click(editor.getByRole('tab', { name: /tuning/i }));
    await expect.element(editor.getByRole('option', { name: /Brightness/i })).toBeVisible();

    expect(describeControls(element)).toMatchInlineSnapshot(`
      [
        "operation-control aria-label=Apply brightness tuning title=Apply brightness tuning text=Brightness icon=brightness inactive",
        "operation-control aria-label=Apply exposure tuning title=Apply exposure tuning text=Exposure icon=exposure inactive",
        "operation-control aria-label=Apply gamma tuning title=Apply gamma tuning text=Gamma icon=gamma inactive",
        "operation-control aria-label=Apply contrast tuning title=Apply contrast tuning text=Contrast icon=contrast inactive",
        "operation-control aria-label=Apply saturation tuning title=Apply saturation tuning text=Saturation icon=saturation inactive",
        "operation-control aria-label=Apply vibrance tuning title=Apply vibrance tuning text=Vibrance icon=vibrance inactive",
        "operation-control aria-label=Apply warmth tuning title=Apply warmth tuning text=Warmth icon=warmth inactive",
        "operation-control aria-label=Apply enhance tuning title=Apply enhance tuning text=Enhance icon=enhance inactive",
      ]
    `);
  });

  it('labels the filter controls', async () => {
    const { element, editor } = renderEditor('1:1');
    await userEvent.click(editor.getByRole('tab', { name: /filters/i }));
    await expect.element(editor.getByRole('option').first()).toBeVisible();

    expect(describeControls(element).slice(0, 3)).toMatchInlineSnapshot(`
      [
        "filter-control aria-label=Apply original filter title=Apply original filter text=∅ icon=original inactive",
        "filter-control aria-label=Apply adaris filter title=Apply adaris filter text=∅ icon=slider inactive",
        "filter-control aria-label=Apply briaril filter title=Apply briaril filter text=∅ icon=slider inactive",
      ]
    `);
  });

  it('relabels the editor when the locale changes', async () => {
    const { config, editor } = renderEditor('1:1');
    await userEvent.click(editor.getByRole('tab', { name: /tuning/i }));
    await expect.element(editor.getByRole('option', { name: 'Apply brightness tuning' })).toBeVisible();

    config.setAttribute('locale-name', 'de');

    const brightness = editor.getByRole('option', { name: 'helligkeit-Abstimmung anwenden' });
    await expect.element(brightness).toBeVisible();
    await expect.element(brightness).toHaveTextContent('Helligkeit');
    await expect.element(editor.getByRole('tab', { name: 'Feinabstimmung' })).toBeVisible();
  });
});
