import { commands, page, userEvent } from '@vitest/browser/context';
import { beforeAll, describe, expect, it } from 'vitest';
import '../types/jsx';
import { IMAGE } from './fixtures/files';
import { renderSolution } from './utils/render-solution';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('Form input', () => {
  it('should create hidden input for form validation', async () => {
    const { ctxName } = await renderSolution('regular', {}, { formInput: true });

    const ucFormInput = page.getByTestId('uc-form-input');
    await expect.element(ucFormInput).toBeInTheDocument();

    const ucFormInputEl = ucFormInput.element();
    const inputEl = ucFormInputEl.querySelector('input');
    await expect.element(inputEl).toBeInTheDocument();
    expect(inputEl?.tagName).toBe('INPUT');
    expect(inputEl?.getAttribute('name')).toBe(ctxName);
  });

  it('should mark validation input as required when multipleMin > 0', async () => {
    await renderSolution('regular', { multipleMin: 1 }, { formInput: true });

    const ucFormInputEl = page.getByTestId('uc-form-input').element();
    const inputEl = ucFormInputEl.querySelector('input')!;
    expect(inputEl.required).toBe(true);
  });

  it('should set single value when multiple is false and one file uploaded', async () => {
    const { config, api } = await renderSolution('regular', {}, { formInput: true });

    config.multiple = false;

    const uploadButton = page.getByText('Upload file', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    const fromDeviceButton = startFrom.getByText('From device', { exact: true });
    await expect.element(startFrom).toBeVisible();
    await Promise.all([
      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']),
      userEvent.click(fromDeviceButton),
    ]);

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();
    await expect.element(page.getByText('1 file uploaded')).toBeVisible();

    const ucFormInputEl = page.getByTestId('uc-form-input').element();
    const inputEl = ucFormInputEl.querySelector('input');

    await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 5000 }).toBeTruthy();

    const cdnUrl = api.getOutputCollectionState().allEntries[0]?.cdnUrl;
    await expect.poll(() => inputEl?.value).toBe(cdnUrl);
  });

  it('should replace single input value when a new file is uploaded', async () => {
    const { config, api } = await renderSolution('regular', {}, { formInput: true });

    config.multiple = false;

    // First upload
    await userEvent.click(page.getByText('Upload file', { exact: true }));
    const startFrom = page.getByTestId('uc-start-from');
    const fromDeviceButton = startFrom.getByText('From device', { exact: true });
    await expect.element(startFrom).toBeVisible();
    await Promise.all([
      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']),
      userEvent.click(fromDeviceButton),
    ]);

    await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 15000 }).toBeTruthy();
    const firstCdn = api.getOutputCollectionState().allEntries[0]?.cdnUrl;
    expect(firstCdn).toBeTruthy();

    await userEvent.click(page.getByLabelText('Remove'));
    await expect.poll(() => api.getOutputCollectionState().allEntries.length, { timeout: 5000 }).toBe(0);

    // Second upload
    await expect.element(startFrom).toBeVisible();
    await Promise.all([
      commands.waitFileChooserAndUpload(['./fixtures/test_image2.jpeg']),
      userEvent.click(fromDeviceButton),
    ]);

    await expect
      .poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 15000 })
      .not.toBe(firstCdn);
    await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 15000 }).toBeTruthy();

    const secondCdn = api.getOutputCollectionState().allEntries[0]?.cdnUrl;

    const inputEl = page.getByTestId('uc-form-input').element().querySelector('input');
    await expect.poll(() => inputEl?.value).toBe(secondCdn);
  });

  it('should set single value using name attr when multiple is false', async () => {
    const nameAttr = 'custom-single-name';

    const { config, api } = await renderSolution('regular', {}, { formInput: { name: nameAttr } });

    config.multiple = false;

    const uploadButton = page.getByText('Upload file', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    const fromDeviceButton = startFrom.getByText('From device', { exact: true });
    await expect.element(startFrom).toBeVisible();
    await Promise.all([
      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']),
      userEvent.click(fromDeviceButton),
    ]);

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();

    const ucFormInputEl = page.getByTestId('uc-form-input').element();
    const inputEl = ucFormInputEl.querySelector('input');

    await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 5000 }).toBeTruthy();

    const cdnUrl = api.getOutputCollectionState().allEntries[0]?.cdnUrl;
    expect(inputEl?.getAttribute('name')).toBe(nameAttr);
    await expect.poll(() => inputEl?.value).toBe(cdnUrl);
  });

  it('should set two inputs when multiple is true and two files uploaded', async () => {
    const { ctxName, config, api } = await renderSolution('regular', {}, { formInput: true });

    config.multiple = true;

    const uploadButton = page.getByText('Upload files', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    const fromDeviceButton = startFrom.getByText('From device', { exact: true });
    await expect.element(startFrom).toBeVisible();
    await Promise.all([
      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg', './fixtures/test_image2.jpeg']),
      userEvent.click(fromDeviceButton),
    ]);

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();

    await expect
      .poll(
        () =>
          api
            .getOutputCollectionState()
            .allEntries.map((entry) => entry.cdnUrl)
            .filter(Boolean).length,
        { timeout: 15000 },
      )
      .toBe(2);

    const cdnUrls = api
      .getOutputCollectionState()
      .allEntries.map((entry) => entry.cdnUrl)
      .filter((url): url is string => Boolean(url));

    const getInputs = () => Array.from(document.querySelectorAll(`input[name="${ctxName}[]"]`)) as HTMLInputElement[];
    await expect.poll(() => getInputs()).toHaveLength(2);
    expect(new Set(getInputs().map((input) => input.value))).toEqual(new Set(cdnUrls));
  });

  it('should set two inputs using name attr when multiple is true', async () => {
    const nameAttr = 'custom-multiple-name';

    const { config, api } = await renderSolution('regular', {}, { formInput: { name: nameAttr } });

    config.multiple = true;

    const uploadButton = page.getByText('Upload files', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    const fromDeviceButton = startFrom.getByText('From device', { exact: true });
    await expect.element(startFrom).toBeVisible();
    await Promise.all([
      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg', './fixtures/test_image2.jpeg']),
      userEvent.click(fromDeviceButton),
    ]);

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();

    await expect
      .poll(
        () =>
          api
            .getOutputCollectionState()
            .allEntries.map((entry) => entry.cdnUrl)
            .filter(Boolean).length,
        { timeout: 15000 },
      )
      .toBe(2);

    const cdnUrls = api
      .getOutputCollectionState()
      .allEntries.map((entry) => entry.cdnUrl)
      .filter((url): url is string => Boolean(url));

    const getInputs = () => Array.from(document.querySelectorAll(`input[name="${nameAttr}[]"]`)) as HTMLInputElement[];
    await expect.poll(() => getInputs()).toHaveLength(2);
    expect(new Set(getInputs().map((input) => input.value))).toEqual(new Set(cdnUrls));
  });

  it('should set single group input when multiple and groupOutput are true', async () => {
    const { ctxName, config, api } = await renderSolution('regular', {}, { formInput: true });

    config.multiple = true;
    config.groupOutput = true;

    const uploadButton = page.getByText('Upload files', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    const fromDeviceButton = startFrom.getByText('From device', { exact: true });
    await expect.element(startFrom).toBeVisible();
    await Promise.all([
      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg', './fixtures/test_image2.jpeg']),
      userEvent.click(fromDeviceButton),
    ]);

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();

    const getGroupCdnUrl = () => api.getOutputCollectionState().group?.cdnUrl;
    await expect.poll(getGroupCdnUrl, { timeout: 15000 }).toBeTruthy();

    const groupCdnUrl = getGroupCdnUrl();
    expect(groupCdnUrl).toBeTruthy();

    await expect
      .poll(() => Array.from(document.querySelectorAll(`input[name="${ctxName}"]`)) as HTMLInputElement[], {
        timeout: 5000,
      })
      .toHaveLength(1);

    const input = document.querySelector(`input[name="${ctxName}"]`) as HTMLInputElement | null;
    await expect.poll(() => input?.value).toBe(groupCdnUrl);
  });

  it('should set validation message on failed collection', async () => {
    const { config, api } = await renderSolution('regular', {}, { formInput: true });

    config.fileValidators = [() => ({ message: 'Bad file' })];

    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();

    const validationInput = page.getByTestId('uc-form-input').element().querySelector('input')!;
    await expect.poll(() => validationInput.validationMessage).toBe('Some files were not uploaded.');
  });

  it('should set group input using name attr when multiple and groupOutput are true', async () => {
    const nameAttr = 'custom-group-name';

    const { config, api } = await renderSolution('regular', {}, { formInput: { name: nameAttr } });

    config.multiple = true;
    config.groupOutput = true;

    const uploadButton = page.getByText('Upload files', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    const fromDeviceButton = startFrom.getByText('From device', { exact: true });
    await expect.element(startFrom).toBeVisible();
    await Promise.all([
      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg', './fixtures/test_image2.jpeg']),
      userEvent.click(fromDeviceButton),
    ]);

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();

    const getGroupCdnUrl = () => api.getOutputCollectionState().group?.cdnUrl;
    await expect.poll(getGroupCdnUrl, { timeout: 15000 }).toBeTruthy();

    const groupCdnUrl = getGroupCdnUrl();
    expect(groupCdnUrl).toBeTruthy();

    await expect
      .poll(() => Array.from(document.querySelectorAll(`input[name="${nameAttr}"]`)) as HTMLInputElement[], {
        timeout: 5000,
      })
      .toHaveLength(1);

    const input = document.querySelector(`input[name="${nameAttr}"]`) as HTMLInputElement | null;
    await expect.poll(() => input?.value).toBe(groupCdnUrl);
  });
});
