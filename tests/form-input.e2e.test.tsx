import { commands, page, userEvent } from '@vitest/browser/context';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Config, UploadCtxProvider } from '@/index';
import '../types/jsx';
import { delay } from '@/utils/delay';
import { IMAGE } from './fixtures/files';
// biome-ignore lint/correctness/noUnusedImports: Used in JSX
import { renderer } from './utils/test-renderer';

beforeAll(async () => {
  // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
  // @ts-ignore
  await import('@/solutions/file-uploader/regular/index.css');
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('Form input', () => {
  it('should create hidden input for form validation', async () => {
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-form-input ctx-name={ctxName}></uc-form-input>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const ucFormInput = page.getByTestId('uc-form-input');
    await expect.element(ucFormInput).toBeInTheDocument();

    const ucFormInputEl = ucFormInput.element();
    const inputEl = ucFormInputEl.querySelector('input');
    await expect.element(inputEl).toBeInTheDocument();
    expect(inputEl?.tagName).toBe('INPUT');
    expect(inputEl?.getAttribute('name')).toBe(ctxName);
  });

  it('should mark validation input as required when multipleMin > 0', async () => {
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config
          qualityInsights={false}
          ctx-name={ctxName}
          pubkey="demopublickey"
          testMode
          multipleMin={1}
        ></uc-config>
        <uc-form-input ctx-name={ctxName}></uc-form-input>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const ucFormInputEl = page.getByTestId('uc-form-input').element();
    const inputEl = ucFormInputEl.querySelector('input')!;
    expect(inputEl.required).toBe(true);
  });

  it('should set single value when multiple is false and one file uploaded', async () => {
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-form-input ctx-name={ctxName}></uc-form-input>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const config = page.getByTestId('uc-config').query()! as Config;
    config.multiple = false;

    commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);

    const uploadButton = page.getByText('Upload file', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    await expect.element(startFrom).toBeVisible();
    await userEvent.click(startFrom.getByText('From device', { exact: true }));

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();
    await expect.element(page.getByText('1 file uploaded')).toBeVisible();

    const ucFormInputEl = page.getByTestId('uc-form-input').element();
    const inputEl = ucFormInputEl.querySelector('input');

    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();

    await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 5000 }).toBeTruthy();

    const cdnUrl = api.getOutputCollectionState().allEntries[0]?.cdnUrl;
    await expect.poll(() => inputEl?.value).toBe(cdnUrl);
  });

  it('should replace single input value when a new file is uploaded', async () => {
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-form-input ctx-name={ctxName}></uc-form-input>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const config = page.getByTestId('uc-config').query()! as Config;
    config.multiple = false;

    // First upload
    commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);
    await userEvent.click(page.getByText('Upload file', { exact: true }));
    await userEvent.click(page.getByTestId('uc-start-from').getByText('From device', { exact: true }));

    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();
    await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 5000 }).toBeTruthy();
    const firstCdn = api.getOutputCollectionState().allEntries[0]?.cdnUrl;

    await userEvent.click(page.getByLabelText('Remove'));

    // Second upload
    commands.waitFileChooserAndUpload(['./fixtures/test_image2.jpeg']);
    await userEvent.click(page.getByTestId('uc-start-from').getByText('From device', { exact: true }));

    await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 5000 }).not.toBe(firstCdn);
    await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 5000 }).toBeTruthy();

    const secondCdn = api.getOutputCollectionState().allEntries[0]?.cdnUrl;

    const inputEl = page.getByTestId('uc-form-input').element().querySelector('input');
    await expect.poll(() => inputEl?.value).toBe(secondCdn);
  });

  it('should set single value using name attr when multiple is false', async () => {
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;
    const nameAttr = 'custom-single-name';

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-form-input ctx-name={ctxName} name={nameAttr}></uc-form-input>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const config = page.getByTestId('uc-config').query()! as Config;
    config.multiple = false;

    commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);

    const uploadButton = page.getByText('Upload file', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    await expect.element(startFrom).toBeVisible();
    await userEvent.click(startFrom.getByText('From device', { exact: true }));

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();

    const ucFormInputEl = page.getByTestId('uc-form-input').element();
    const inputEl = ucFormInputEl.querySelector('input');

    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();

    await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 5000 }).toBeTruthy();

    const cdnUrl = api.getOutputCollectionState().allEntries[0]?.cdnUrl;
    expect(inputEl?.getAttribute('name')).toBe(nameAttr);
    await expect.poll(() => inputEl?.value).toBe(cdnUrl);
  });

  it('should set two inputs when multiple is true and two files uploaded', async () => {
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-form-input ctx-name={ctxName}></uc-form-input>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const config = page.getByTestId('uc-config').query()! as Config;
    config.multiple = true;

    commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg', './fixtures/test_image2.jpeg']);

    const uploadButton = page.getByText('Upload files', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    await expect.element(startFrom).toBeVisible();
    await userEvent.click(startFrom.getByText('From device', { exact: true }));

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();

    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();

    await expect
      .poll(
        () =>
          api
            .getOutputCollectionState()
            .allEntries.map((entry) => entry.cdnUrl)
            .filter(Boolean).length,
        { timeout: 5000 },
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
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;
    const nameAttr = 'custom-multiple-name';

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-form-input ctx-name={ctxName} name={nameAttr}></uc-form-input>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const config = page.getByTestId('uc-config').query()! as Config;
    config.multiple = true;

    commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg', './fixtures/test_image2.jpeg']);

    const uploadButton = page.getByText('Upload files', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    await expect.element(startFrom).toBeVisible();
    await userEvent.click(startFrom.getByText('From device', { exact: true }));

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();

    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();

    await expect
      .poll(
        () =>
          api
            .getOutputCollectionState()
            .allEntries.map((entry) => entry.cdnUrl)
            .filter(Boolean).length,
        { timeout: 5000 },
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
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-form-input ctx-name={ctxName}></uc-form-input>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const config = page.getByTestId('uc-config').query()! as Config;
    config.multiple = true;
    config.groupOutput = true;

    commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg', './fixtures/test_image2.jpeg']);

    const uploadButton = page.getByText('Upload files', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    await expect.element(startFrom).toBeVisible();
    await userEvent.click(startFrom.getByText('From device', { exact: true }));

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();

    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();

    await expect.poll(() => api.getOutputCollectionState().group?.cdnUrl, { timeout: 5000 }).toBeTruthy();

    const groupCdnUrl = api.getOutputCollectionState().group?.cdnUrl;

    const inputs = Array.from(document.querySelectorAll(`input[name="${ctxName}"]`)) as HTMLInputElement[];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.value).toBe(groupCdnUrl);
  });

  it('should set validation message on failed collection', async () => {
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-form-input ctx-name={ctxName}></uc-form-input>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const config = page.getByTestId('uc-config').query()! as Config;
    config.fileValidators = [() => ({ message: 'Bad file' })];

    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();

    const validationInput = page.getByTestId('uc-form-input').element().querySelector('input')!;
    await expect.poll(() => validationInput.validationMessage).toBe('Some files were not uploaded.');
  });

  it('should set group input using name attr when multiple and groupOutput are true', async () => {
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;
    const nameAttr = 'custom-group-name';

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-form-input ctx-name={ctxName} name={nameAttr}></uc-form-input>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const config = page.getByTestId('uc-config').query()! as Config;
    config.multiple = true;
    config.groupOutput = true;

    commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg', './fixtures/test_image2.jpeg']);

    const uploadButton = page.getByText('Upload files', { exact: true });
    await userEvent.click(uploadButton);

    const startFrom = page.getByTestId('uc-start-from');
    await expect.element(startFrom).toBeVisible();
    await userEvent.click(startFrom.getByText('From device', { exact: true }));

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();

    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();

    await expect.poll(() => api.getOutputCollectionState().group?.cdnUrl, { timeout: 5000 }).toBeTruthy();

    const groupCdnUrl = api.getOutputCollectionState().group?.cdnUrl;

    const inputs = Array.from(document.querySelectorAll(`input[name="${nameAttr}"]`)) as HTMLInputElement[];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.value).toBe(groupCdnUrl);
  });
});
