import { expect } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index';
import { delay } from '@/utils/delay';
import { toKebabCase } from '@/utils/toKebabCase';
import { getCtxName } from './test-renderer';
import '../../types/jsx';

/**
 * Renders one of the three uploader solutions with a fresh `ctx-name` and hands back the pieces every test needs.
 *
 * `tests/plugins/utils.tsx` has a similar helper scoped to plugin tests; this one is the general-purpose version for
 * the specs in `tests/`. They are deliberately not merged yet — folding the existing e2e files onto a shared harness
 * is a refactor of tests that already pass, and belongs in its own change.
 */

export type Solution = 'regular' | 'minimal' | 'inline';

const solutionTag = {
  regular: 'uc-file-uploader-regular',
  minimal: 'uc-file-uploader-minimal',
  inline: 'uc-file-uploader-inline',
} as const satisfies Record<Solution, string>;

export type RenderedUploader = {
  ctxName: string;
  config: Config;
  provider: UploadCtxProvider;
  api: ReturnType<UploadCtxProvider['getAPI']>;
  /** The solution element. Blocks inside it carry no `ctx-name`, so it is the only way to scope a query to this ctx. */
  root: HTMLElement;
};

/** The one element of `tag` belonging to `ctxName`. Throws rather than returning null, so a typo fails loudly. */
export function inCtx<T extends Element>(tag: string, ctxName: string): T {
  const element = document.querySelector<T>(`${tag}[ctx-name="${ctxName}"]`);
  if (!element) {
    throw new Error(`No <${tag}> found for ctx-name "${ctxName}"`);
  }
  return element;
}

export type RenderOptions = {
  /** `null` renders `<uc-config>` without one, for tests that set it themselves and watch what it derives. */
  pubkey?: string | null;
  /** Adds `<uc-form-input>` to the ctx; pass a name to set its `name` attribute. */
  formInput?: boolean | { name: string };
};

/**
 * Options that can be expressed as an attribute, which is everything primitive. They are set **before** the elements
 * are connected, because several blocks read config once while initialising — `<uc-form-input>` decides whether its
 * validation input is `required` when it creates it, and `TelemetryManager` sends its first events during init, so a
 * value assigned after render is already too late.
 */
const isAttributeValue = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

/**
 * `configProps` reach the element as attributes where they can, and as DOM properties otherwise — validators,
 * resolvers, `metadata`, `tags` and anything else that is not a primitive.
 *
 * Elements are built imperatively rather than through JSX on purpose: render-jsx drops a `false`-valued prop
 * entirely, so `qualityInsights={false}` silently did nothing, and the generated JSX types reject the string form
 * that works. Building them by hand sidesteps both.
 */
export async function renderSolution(
  solution: Solution = 'regular',
  configProps: Partial<Config> = {},
  { pubkey = 'demopublickey', formInput = false }: RenderOptions = {},
): Promise<RenderedUploader> {
  const ctxName = getCtxName();

  const create = <T extends Element>(tag: string, attrs: Record<string, string> = {}): T => {
    const element = document.createElement(tag);
    element.setAttribute('ctx-name', ctxName);
    for (const [name, value] of Object.entries(attrs)) {
      element.setAttribute(name, value);
    }
    return element as unknown as T;
  };

  const configAttrs: Record<string, string> = { 'test-mode': 'true', 'quality-insights': 'false' };
  if (pubkey !== null) {
    configAttrs.pubkey = pubkey;
  }
  const propsForLater: Partial<Config> = {};
  for (const [name, value] of Object.entries(configProps)) {
    if (isAttributeValue(value)) {
      configAttrs[toKebabCase(name)] = String(value);
    } else {
      Object.assign(propsForLater, { [name]: value });
    }
  }

  const root = create<HTMLElement>(solutionTag[solution]);
  const config = create<Config>('uc-config', configAttrs);
  const provider = create<UploadCtxProvider>('uc-upload-ctx-provider');

  page.render(<div ctx-name={ctxName}></div>);
  const host = inCtx<HTMLElement>('div', ctxName);
  host.append(root, config);
  if (formInput) {
    host.append(create('uc-form-input', typeof formInput === 'object' ? { name: formInput.name } : {}));
  }
  host.append(provider);

  Object.assign(config, propsForLater);

  // One tick so the solution's blocks register with the ctx before a test drives them.
  await delay(0);

  return { ctxName, config, provider, api: provider.getAPI(), root };
}

/**
 * Locators scoped to one uploader.
 *
 * `page.getByTestId` searches the whole document, and `page.render` appends rather than replaces, so a test with two
 * uploaders trips strict mode on every shared test id. `page.elementLocator` gives the same locator API rooted at a
 * single element, which is what the `root` returned by `renderSolution` is for.
 *
 * The ids are the ones `testMode` derives from each block's tag name (`LitBlock.testId`), and this reads the same
 * attribute vitest's own `getByTestId` does — `browser.locators.testIdAttribute`, `data-testid` by default.
 */
export const within = (root: HTMLElement) => page.elementLocator(root);

/**
 * Asserts which activity is on screen, by activity id rather than by tag.
 *
 * `LitActivityBlock.initCallback` stamps `activity="<id>"` on every activity host and `_activate()` adds `active`, so
 * `[activity="url"][active]` is the one signal that works for both kinds of activity. Tags do not: `start-from` and
 * `upload-list` are their own elements, while `url`, `camera`, `external` and `cloud-image-edit` come from lazy
 * plugins and live inside a generic `<uc-plugin-activity-host>` — `<uc-url-source>` itself is a plain
 * `LitUploaderBlock` and never becomes active.
 *
 * This is the honest "is it really showing" check; `api.getCurrentActivity()` stays correct while the DOM is broken.
 *
 * Scoped to `root` because activity hosts live inside the solution's template and carry no `ctx-name` of their own —
 * only the tags an integrator writes by hand have one.
 */
export async function expectActivity(root: HTMLElement, activityId: string): Promise<void> {
  // Keyed on the activity id rather than a test id: the id is what the router sets, and one generic
  // `<uc-plugin-activity-host>` serves every plugin activity, so their test ids are all identical.
  await expect.poll(() => root.querySelector(`[activity="${activityId}"]`)?.hasAttribute('active') ?? false).toBe(true);
}

/**
 * Asserts a modal is really on screen, not merely selected in state.
 *
 * `<uc-modal>` renders a light-DOM `<dialog>` and calls `showModal()` on it, so `dialog.open` is the honest signal.
 * Every `uc-modal` shares one `data-testid` (it is derived from the tag name), so the id is the only discriminator.
 */
export async function expectModal(root: HTMLElement, id: string, state: 'open' | 'closed'): Promise<void> {
  await expect.poll(() => modalDialog(root, id)?.open ?? false).toBe(state === 'open');
}

export function modalDialog(root: HTMLElement, id: string): HTMLDialogElement | null {
  const modal = within(root)
    .getByTestId('uc-modal')
    .elements()
    .find((element) => element.id === id);
  return modal?.querySelector('dialog') ?? null;
}
