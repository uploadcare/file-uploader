import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { unsplashPlugin } from '@/plugins/unsplashPlugin';
import { delay } from '@/utils/delay';
import { expectActivity, renderSolution } from './utils/render-solution';
import '../types/jsx';

/**
 * The built-in Unsplash plugin is exported from the package and registers a source, an activity and its own config
 * option, but nothing rendered it — the file sat at 0%.
 *
 * `fetch` is stubbed, so no API key and no network are needed. That is the only thing standing between this file and
 * coverage; the plugin is otherwise ordinary.
 */

const PHOTO = {
  id: 'abc123',
  urls: { small: 'https://images.example.com/small.jpg', full: 'https://images.example.com/full.jpg' },
  alt_description: 'a cat',
  user: { name: 'A Photographer' },
};

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

let fetchSpy: MockInstance<typeof window.fetch>;

beforeEach(() => {
  fetchSpy = vi.spyOn(window, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

const okResponse = (photos: unknown[] = [PHOTO]) =>
  ({ ok: true, status: 200, statusText: 'OK', json: async () => photos }) as Response;

/**
 * Calls the plugin made, ignoring everything else on the page. The uploader's own telemetry also goes through
 * `fetch`, and some of it is sent during init before a test can turn `qualityInsights` off.
 */
const isUnsplashApi = (url: string) => {
  try {
    return new URL(url).host === 'api.unsplash.com';
  } catch {
    return false;
  }
};

const unsplashCalls = () => fetchSpy.mock.calls.map((call) => String(call[0])).filter(isUnsplashApi);

/** Renders the uploader with the plugin registered and opens its activity. */
const openUnsplash = async (accessKey = 'test-key') => {
  const rendered = await renderSolution('regular', { plugins: [unsplashPlugin] });
  Object.assign(rendered.config, { unsplashAccessKey: accessKey });
  await delay(100);

  rendered.api.setCurrentActivity('unsplash-gallery');
  rendered.api.setModalState(true);
  await expectActivity(rendered.root, 'unsplash-gallery');

  const activity = rendered.root.querySelector('uc-unsplash-activity') as HTMLElement;
  return { ...rendered, activity };
};

describe('unsplash plugin', () => {
  it('registers a source on the start-from screen', async () => {
    const { root, api, config } = await renderSolution('regular', { plugins: [unsplashPlugin] });
    config.sourceList = 'local, unsplash';
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect.element(page.getByTestId('uc-start-from').getByText('Unsplash', { exact: true })).toBeVisible();
  });

  it('asks the API for photos with the configured key', async () => {
    fetchSpy.mockResolvedValue(okResponse());
    await openUnsplash('my-key');

    await vi.waitFor(() => expect(unsplashCalls()).not.toHaveLength(0));
    const [url] = unsplashCalls();
    expect(url).toContain('https://api.unsplash.com/photos/random');
    expect(url).toContain('client_id=my-key');
    expect(url).toContain('count=24');
  });

  it('explains itself when no key is configured', async () => {
    const { activity } = await openUnsplash('');

    // The message is the contract: `_load` returns before touching the network when there is no key.
    await expect.poll(() => activity.textContent).toContain('No Unsplash API key configured');
  });

  it('surfaces an API error', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' } as Response);
    const { activity } = await openUnsplash();

    await expect.poll(() => activity.textContent).toContain('Unsplash API error: 401 Unauthorized');
  });

  it('surfaces a network failure', async () => {
    fetchSpy.mockRejectedValue(new Error('offline'));
    const { activity } = await openUnsplash();

    await expect.poll(() => activity.textContent).toContain('offline');
  });

  it('sends the search term when one is typed', async () => {
    fetchSpy.mockResolvedValue(okResponse());
    const { activity } = await openUnsplash();
    await vi.waitFor(() => expect(unsplashCalls()).not.toHaveLength(0));
    fetchSpy.mockClear();

    const input = activity.querySelector('input.search-input') as HTMLInputElement;
    await userEvent.fill(input, 'cats');
    await userEvent.keyboard('{Enter}');

    await vi.waitFor(() => expect(unsplashCalls()).not.toHaveLength(0));
    expect(unsplashCalls()[0]).toContain('query=cats');
  });

  it('adds the picked photo to the collection', async () => {
    fetchSpy.mockResolvedValue(okResponse());
    const { activity, api } = await openUnsplash();

    await expect.poll(() => activity.querySelectorAll('img').length).toBeGreaterThan(0);
    await userEvent.click(activity.querySelector('img') as HTMLElement);

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
    const [entry] = api.getOutputCollectionState().allEntries;
    expect(entry.name).toBe(`unsplash-${PHOTO.id}.jpg`);
    expect(entry.externalUrl).toBe(PHOTO.urls.full);
  });
});
