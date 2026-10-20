import { describe, expect, it } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import type { FormInput } from '@/index';
import '~/types/jsx';
import { IMAGE } from '~/tests/fixtures/files';
import { inCtx, renderSolution, within } from '~/tests/utils/render-solution';

/**
 * `<uc-form-input>` mirrors the collection into hidden `<input>`s a surrounding `<form>` can submit. The inputs it
 * creates carry no test id, so they are read straight off the element; `inCtx` finds it because `renderSolution`
 * appends it next to the solution root, not inside it.
 */

const formInput = (ctxName: string) => inCtx<FormInput>('uc-form-input', ctxName);

/** Values of the hidden inputs named `name`, which is how a form would see the output. */
const inputValues = (ctxName: string, name: string) =>
  [...formInput(ctxName).querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].map((input) => input.value);

/** Picks `files` through the start-from "From device" button and waits for the upload list to show. */
const uploadFromDevice = async (root: HTMLElement, files: string[]) => {
  await within(root)
    .getByText(/^Upload files?$/)
    .click();

  const startFrom = within(root).getByTestId('uc-start-from');
  await expect.element(startFrom).toBeVisible();
  await Promise.all([
    commands.waitFileChooserAndUpload(files),
    startFrom.getByText('From device', { exact: true }).click(),
  ]);

  await expect.element(within(root).getByTestId('uc-upload-list')).toBeVisible();
};

const cdnUrls = (api: Awaited<ReturnType<typeof renderSolution>>['api']) =>
  api
    .getOutputCollectionState()
    .allEntries.map((entry) => entry.cdnUrl)
    .filter((url): url is string => Boolean(url));

describe('uc-form-input', () => {
  it('creates a hidden input named after the ctx', async () => {
    const { ctxName } = await renderSolution('regular', {}, { formInput: true });

    const inputEl = formInput(ctxName).querySelector('input');
    await expect.element(inputEl).toBeInTheDocument();
    expect(inputEl?.tagName).toBe('INPUT');
    expect(inputEl?.getAttribute('name')).toBe(ctxName);
  });

  describe('single file (multiple: false)', () => {
    it('sets the cdn url as the input value', async () => {
      const { ctxName, root, api } = await renderSolution('regular', { multiple: false }, { formInput: true });

      await uploadFromDevice(root, ['../fixtures/test_image.jpeg']);
      await expect.element(within(root).getByText('1 file uploaded')).toBeVisible();

      await expect.poll(() => cdnUrls(api), { timeout: 5000 }).toHaveLength(1);
      await expect.poll(() => inputValues(ctxName, ctxName)).toEqual(cdnUrls(api));
    });

    it('replaces the value when a new file is uploaded', async () => {
      const { ctxName, root, api } = await renderSolution('regular', { multiple: false }, { formInput: true });

      await uploadFromDevice(root, ['../fixtures/test_image.jpeg']);
      await expect.poll(() => cdnUrls(api), { timeout: 15000 }).toHaveLength(1);
      const [firstCdn] = cdnUrls(api);

      await userEvent.click(within(root).getByLabelText('Remove'));
      await expect.poll(() => api.getOutputCollectionState().allEntries.length, { timeout: 5000 }).toBe(0);

      const startFrom = within(root).getByTestId('uc-start-from');
      await expect.element(startFrom).toBeVisible();
      await Promise.all([
        commands.waitFileChooserAndUpload(['../fixtures/test_image2.jpeg']),
        startFrom.getByText('From device', { exact: true }).click(),
      ]);

      await expect.poll(() => cdnUrls(api), { timeout: 15000 }).toHaveLength(1);
      const [secondCdn] = cdnUrls(api);
      expect(secondCdn).not.toBe(firstCdn);

      await expect.poll(() => inputValues(ctxName, ctxName)).toEqual([secondCdn]);
    });

    it('uses the name attribute for the input', async () => {
      const nameAttr = 'custom-single-name';
      const { ctxName, root, api } = await renderSolution(
        'regular',
        { multiple: false },
        { formInput: { name: nameAttr } },
      );

      await uploadFromDevice(root, ['../fixtures/test_image.jpeg']);

      await expect.poll(() => cdnUrls(api), { timeout: 5000 }).toHaveLength(1);
      await expect.poll(() => inputValues(ctxName, nameAttr)).toEqual(cdnUrls(api));
    });
  });

  describe('several files (multiple: true)', () => {
    it('sets one array-named input per file', async () => {
      const { ctxName, root, api } = await renderSolution('regular', { multiple: true }, { formInput: true });

      await uploadFromDevice(root, ['../fixtures/test_image.jpeg', '../fixtures/test_image2.jpeg']);

      await expect.poll(() => cdnUrls(api), { timeout: 15000 }).toHaveLength(2);
      await expect.poll(() => inputValues(ctxName, `${ctxName}[]`)).toHaveLength(2);
      expect(new Set(inputValues(ctxName, `${ctxName}[]`))).toEqual(new Set(cdnUrls(api)));
    });

    it('uses the name attribute for the array inputs', async () => {
      const nameAttr = 'custom-multiple-name';
      const { ctxName, root, api } = await renderSolution(
        'regular',
        { multiple: true },
        { formInput: { name: nameAttr } },
      );

      await uploadFromDevice(root, ['../fixtures/test_image.jpeg', '../fixtures/test_image2.jpeg']);

      await expect.poll(() => cdnUrls(api), { timeout: 15000 }).toHaveLength(2);
      await expect.poll(() => inputValues(ctxName, `${nameAttr}[]`)).toHaveLength(2);
      expect(new Set(inputValues(ctxName, `${nameAttr}[]`))).toEqual(new Set(cdnUrls(api)));
    });
  });

  describe('group output (multiple + groupOutput)', () => {
    const groupCdnUrl = (api: Awaited<ReturnType<typeof renderSolution>>['api']) =>
      api.getOutputCollectionState().group?.cdnUrl;

    it('sets a single input holding the group url', async () => {
      const { ctxName, root, api } = await renderSolution(
        'regular',
        { multiple: true, groupOutput: true },
        { formInput: true },
      );

      await uploadFromDevice(root, ['../fixtures/test_image.jpeg', '../fixtures/test_image2.jpeg']);

      await expect.poll(() => groupCdnUrl(api), { timeout: 15000 }).toBeTruthy();
      await expect.poll(() => inputValues(ctxName, ctxName), { timeout: 5000 }).toEqual([groupCdnUrl(api)]);
    });

    it('uses the name attribute for the group input', async () => {
      const nameAttr = 'custom-group-name';
      const { ctxName, root, api } = await renderSolution(
        'regular',
        { multiple: true, groupOutput: true },
        { formInput: { name: nameAttr } },
      );

      await uploadFromDevice(root, ['../fixtures/test_image.jpeg', '../fixtures/test_image2.jpeg']);

      await expect.poll(() => groupCdnUrl(api), { timeout: 15000 }).toBeTruthy();
      await expect.poll(() => inputValues(ctxName, nameAttr), { timeout: 5000 }).toEqual([groupCdnUrl(api)]);
    });
  });
});

/**
 * The validation `<input>` `<uc-form-input>` keeps for the surrounding form: `required` and the custom validity
 * message. The input has no test id, so it is read off the block element.
 */

const validationInput = (ctxName: string) =>
  inCtx<FormInput>('uc-form-input', ctxName).querySelector('input') as HTMLInputElement;

describe('uc-form-input validity', () => {
  it('marks the input required when multipleMin > 0', async () => {
    const { ctxName } = await renderSolution('regular', { multipleMin: 1 }, { formInput: true });

    expect(validationInput(ctxName).required).toBe(true);
  });

  it('sets a validation message when the collection fails validation', async () => {
    const { ctxName, api } = await renderSolution(
      'regular',
      { fileValidators: [() => ({ message: 'Bad file' })] },
      { formInput: true },
    );

    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();

    await expect.poll(() => validationInput(ctxName).validationMessage).toBe('Some files were not uploaded.');
  });
});
