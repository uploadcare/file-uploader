import { expect } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index';
import { delay } from '@/utils/delay';
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
};

/**
 * `configProps` are applied as JS properties after render. That is how a test sets anything with no attribute form
 * (validators, resolvers, `metadata`, `tags`, …) — and also the only reliable way to set a **false** boolean here:
 * render-jsx drops `prop={false}` entirely, so writing it in the JSX leaves the option at its default.
 */
export async function renderSolution(
  solution: Solution = 'regular',
  configProps: Partial<Config> = {},
): Promise<RenderedUploader> {
  const ctxName = getCtxName();
  const Solution = solutionTag[solution];

  page.render(
    <>
      <Solution ctx-name={ctxName}></Solution>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );

  // Queries are scoped by ctx-name rather than testid: `page.render` appends a container instead of replacing the
  // previous one, so a test that renders two uploaders has two of every tag on the page.
  const config = inCtx<Config>('uc-config', ctxName);
  // Set as a DOM property, not in the JSX above: render-jsx drops `prop={false}`, so the `qualityInsights={false}`
  // that most of the existing e2e files declare never actually disables telemetry.
  config.qualityInsights = false;
  Object.assign(config, configProps);

  // One tick so the solution's blocks register with the ctx before a test drives them.
  await delay(0);

  const provider = inCtx<UploadCtxProvider>('uc-upload-ctx-provider', ctxName);
  return { ctxName, config, provider, api: provider.getAPI() };
}

/** The one element of `tag` belonging to `ctxName`. Throws rather than returning null, so a typo fails loudly. */
export function inCtx<T extends Element>(tag: string, ctxName: string): T {
  const element = document.querySelector<T>(`${tag}[ctx-name="${ctxName}"]`);
  if (!element) {
    throw new Error(`No <${tag}> found for ctx-name "${ctxName}"`);
  }
  return element;
}

/** Asserts the activity block is the active one — the `active` attribute is what CSS and the router both key off. */
export async function expectActivity(tag: `uc-${string}`, ctxName: string): Promise<void> {
  await expect.poll(() => inCtx(tag, ctxName).hasAttribute('active')).toBe(true);
}
