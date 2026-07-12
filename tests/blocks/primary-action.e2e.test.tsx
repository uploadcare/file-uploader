import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
// `SourceButtonConfig` is not re-exported from `@/index.ts` (only the `SourceBtn`
// class is), so it's imported directly from its source module — same pattern as
// tests/blocks/source-btn.e2e.test.tsx.
import type { SourceButtonConfig } from '@/blocks/SourceBtn/SourceBtn.ts';
import type { Config, Icon, OutputCollectionState, OutputCollectionStatus, PrimaryAction } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

// `PrimaryAction.entries` only reads `status`, `allEntries`, the per-status
// counts, `isSuccess`, and `totalCount` (see src/blocks/DynamicBtn/PrimaryAction.ts).
// Fixtures below are plain objects shaped to satisfy just those fields; the
// cast is narrowed to the public `OutputCollectionState` shape (not `any`).
type Entries = OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'>;

// Booleans are driven as JS properties on `config` after render (same pattern
// as tests/blocks/simple-btn.e2e.test.tsx's `config.multiple = false`), not as
// JSX attributes: the render-jsx `CommonDOMRenderer` maps a `false`-valued JSX
// prop to `removeAttribute` (see node_modules/render-jsx dom renderer), which
// is a no-op on an attribute that was never present — so `dynamicButtonShowFirstIcon={false}`
// would silently fail to override the `true` default.
const renderPrimaryAction = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-primary-action ctx-name={ctxName}></uc-primary-action>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const config = page.getByTestId('uc-config').query()! as Config;
  const btn = document.querySelector('uc-primary-action')! as PrimaryAction;
  return { ctxName, config, btn };
};

const buttonText = () => document.querySelector('uc-primary-action button span')?.textContent;
const ariaLabel = () => document.querySelector('uc-primary-action button')?.getAttribute('aria-label');
const iconEl = () => document.querySelector('uc-primary-action uc-icon');
const thumbEl = () => document.querySelector('uc-primary-action uc-thumb');
// PrimaryAction binds `<uc-icon .name=...>` as a JS property (not an
// attribute), so the icon's identity must be read off the `.name` property —
// `getAttribute('name')` is never set here.
const iconName = () => (iconEl() as Icon | null)?.name;

describe('uc-primary-action', () => {
  it('with no entries, renders the localized "upload from …" composition as text and aria-label', async () => {
    // BRIEF CORRECTION: the brief's fixture used `label: 'from-device'`, but
    // that string is not an en.ts l10n key at all (grep confirms no such key
    // anywhere in src/locales) — l10n would fall back to the raw key and
    // produce the nonsensical "Upload from-device". The real production
    // label for the local source is `src-type-local` (see
    // src/plugins/localSourcePlugin.ts), whose l10n value is "From device".
    // This test pins that real composition instead.
    const { btn } = renderPrimaryAction();
    const onClick = vi.fn();
    const source: SourceButtonConfig = { id: 'local', label: 'src-type-local', onClick };
    btn.source = source;
    btn.entries = { totalCount: 0, allEntries: [] } as unknown as Entries;

    await expect.poll(buttonText).toBe('Upload from device');
    expect(ariaLabel()).toBe('Upload from device');
  });

  it('renders the header-uploading text with count while uploading', async () => {
    const { btn } = renderPrimaryAction();
    btn.entries = { status: 'uploading', uploadingCount: 2, allEntries: [{}], totalCount: 2 } as unknown as Entries;

    await expect.poll(buttonText).toBe('Uploading 2 files');
  });

  it('renders the header-failed text with count when failed', async () => {
    const { btn } = renderPrimaryAction();
    btn.entries = { status: 'failed', failedCount: 1, allEntries: [{}], totalCount: 1 } as unknown as Entries;

    await expect.poll(buttonText).toBe('1 error');
  });

  it('renders the header-succeed text with count on success', async () => {
    const { btn } = renderPrimaryAction();
    btn.entries = {
      status: 'success',
      successCount: 3,
      allEntries: [{}, {}, {}],
      isSuccess: true,
      totalCount: 3,
    } as unknown as Entries;

    await expect.poll(buttonText).toBe('3 files uploaded');
  });

  it('renders the header-total text for idle entries with totalCount > 0 (not uploading/failed/success)', async () => {
    // `_headerTextDependentOnEntries` (src/blocks/DynamicBtn/PrimaryAction.ts)
    // only special-cases `status` 'uploading' | 'failed' | 'success'; any
    // other status (e.g. 'idle') with `totalCount > 0` falls through to the
    // `header-total` l10n key: '{{count}} {{plural:file(count)}} selected'.
    const { btn } = renderPrimaryAction();
    btn.entries = { status: 'idle', totalCount: 2, allEntries: [{}, {}] } as unknown as Entries;

    await expect.poll(buttonText).toBe('2 files selected');
  });

  it('renders the source icon when dynamicButtonShowFirstIcon is truthy and there are no entries', async () => {
    const { config, btn } = renderPrimaryAction();
    config.dynamicButtonShowFirstIcon = true;
    btn.source = { id: 'local', label: 'src-type-local', icon: 'my-icon', onClick: () => {} };
    btn.entries = { totalCount: 0, allEntries: [] } as unknown as Entries;

    await expect.poll(iconName).toBe('my-icon');
  });

  it('does not render the source icon when dynamicButtonShowFirstIcon is false', async () => {
    const { config, btn } = renderPrimaryAction();
    config.dynamicButtonShowFirstIcon = false;
    btn.source = { id: 'local', label: 'src-type-local', icon: 'my-icon', onClick: () => {} };
    btn.entries = { totalCount: 0, allEntries: [] } as unknown as Entries;

    await expect.poll(buttonText).toBe('Upload from device');
    expect(iconEl()).toBeNull();
  });

  it('renders a uc-thumb for a single successful image entry when not multiple', async () => {
    const { config, btn } = renderPrimaryAction();
    config.multiple = false;
    await expect.poll(() => config.multiple).toBe(false);
    btn.entries = {
      status: 'success',
      successCount: 1,
      isSuccess: true,
      totalCount: 1,
      allEntries: [{ isImage: true, internalId: 'test-uid' }],
    } as unknown as Entries;

    await expect.poll(() => thumbEl()).toBeTruthy();
  });

  it('renders neither a thumb nor an icon for a single successful image entry when multiple', async () => {
    const { config, btn } = renderPrimaryAction();
    config.multiple = true;
    config.dynamicButtonShowFirstIcon = true;
    btn.source = { id: 'local', label: 'src-type-local', icon: 'my-icon', onClick: () => {} };
    btn.entries = {
      status: 'success',
      successCount: 1,
      isSuccess: true,
      totalCount: 1,
      allEntries: [{ isImage: true, internalId: 'test-uid' }],
    } as unknown as Entries;

    await expect.poll(buttonText).toBe('1 file uploaded');
    expect(thumbEl()).toBeNull();
    expect(iconEl()).toBeNull();
  });

  it('clicking with no entries invokes source.onClick', async () => {
    const { btn } = renderPrimaryAction();
    const onClick = vi.fn();
    btn.source = { id: 'local', label: 'src-type-local', onClick };
    btn.entries = { totalCount: 0, allEntries: [] } as unknown as Entries;
    await expect.poll(buttonText).toBe('Upload from device');

    (document.querySelector('uc-primary-action button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(onClick).toHaveBeenCalledOnce());
  });

  it('clicking with entries present does NOT invoke source.onClick (navigates instead)', async () => {
    const { btn } = renderPrimaryAction();
    const onClick = vi.fn();
    btn.source = { id: 'local', label: 'src-type-local', onClick };
    btn.entries = {
      status: 'success',
      successCount: 1,
      isSuccess: true,
      totalCount: 1,
      allEntries: [{ isImage: false, internalId: 'test-uid' }],
    } as unknown as Entries;
    await expect.poll(buttonText).toBe('1 file uploaded');

    // `_handleClick` is synchronous and branches on `hasEntries` before ever
    // touching `source.onClick`, so no wait is needed to observe the result;
    // still flush one update cycle so any (deliberately unobserved) router
    // navigation settles before the assertion.
    (document.querySelector('uc-primary-action button') as HTMLButtonElement).click();
    await btn.updateComplete;
    expect(onClick).not.toHaveBeenCalled();
  });

  it('reflects data-testid under testMode', async () => {
    renderPrimaryAction();
    await expect.element(page.getByTestId('uc-primary-action')).toBeInTheDocument();
  });
});
