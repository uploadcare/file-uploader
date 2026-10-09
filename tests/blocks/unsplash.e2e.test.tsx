import { DEMO_IMAGE_UUID } from '@uploadcare/api-emulator';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { unsplashPlugin } from '@/plugins/unsplashPlugin';
import { emulatorSession, isLive } from '~/tests/utils/emulator.browser';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * The built-in Unsplash plugin is exported from the package and registers a source, an activity and its own config
 * option, but nothing rendered it — the file sat at 0%.
 *
 * The emulator answers `api.unsplash.com` too (`emulator.browser.ts` lists it as an emulated host), and each test
 * routes its endpoint with `session.on()`, so the plugin's own `fetch` and response handling run and no API key is
 * needed. The photos point at an emulated CDN file, so their thumbnails load and a picked one can be uploaded.
 *
 * Fake-only (`describe.skipIf(isLive)`) where a test needs the route: live, there is no emulator to answer it.
 */

const PHOTO_URL = `https://ucarecdn.com/${DEMO_IMAGE_UUID}/`;
const PHOTO = {
  id: 'abc123',
  urls: { small: `${PHOTO_URL}-/preview/200x200/`, full: PHOTO_URL },
  alt_description: 'a cat',
  user: { name: 'A Photographer' },
};

const PHOTOS_ENDPOINT = { host: 'api.unsplash.com', path: '/photos/random' };

/** Answers the photos endpoint with `response`, or with one photo. */
const routePhotos = (response: () => Response = () => Response.json([PHOTO])) =>
  emulatorSession().on(PHOTOS_ENDPOINT, response);

/** The query strings of the plugin's calls to the photos endpoint, in order. */
const photoQueries = () =>
  emulatorSession()
    .requests.map((request) => new URL(request.url))
    .filter((url) => url.host === PHOTOS_ENDPOINT.host && url.pathname === PHOTOS_ENDPOINT.path)
    .map((url) => url.searchParams);

/** Renders the uploader with the plugin registered and opens its activity. */
const openUnsplash = async (accessKey = 'test-key') => {
  const rendered = await renderSolution('regular', { plugins: [unsplashPlugin], unsplashAccessKey: accessKey });

  rendered.api.setCurrentActivity('unsplash-gallery');
  rendered.api.setModalState(true);
  await expectActivity(rendered.root, 'unsplash-gallery');

  // The plugin's activity element is not a block, so it has no test id.
  const activity = rendered.root.querySelector('uc-unsplash-activity') as HTMLElement;
  return { ...rendered, activity };
};

describe('unsplash plugin', () => {
  it('registers a source on the start-from screen', async () => {
    const { root, api } = await renderSolution('regular', { plugins: [unsplashPlugin], sourceList: 'local, unsplash' });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect
      .element(within(root).getByTestId('uc-start-from').getByText('Unsplash', { exact: true }))
      .toBeVisible();
  });

  it('explains itself when no key is configured', async () => {
    const { activity } = await openUnsplash('');

    // The message is the contract: `_load` returns before touching the network when there is no key.
    await expect.poll(() => activity.textContent).toContain('No Unsplash API key configured');
  });
});

describe.skipIf(isLive)('unsplash plugin, against a routed API', () => {
  it('asks the API for photos with the configured key', async () => {
    routePhotos();
    await openUnsplash('my-key');

    await expect.poll(() => photoQueries()).toHaveLength(1);
    const [query] = photoQueries();
    expect(query.get('client_id')).toBe('my-key');
    expect(query.get('count')).toBe('24');
  });

  it('surfaces an API error', async () => {
    routePhotos(() => new Response(null, { status: 401, statusText: 'Unauthorized' }));
    const { activity } = await openUnsplash();

    await expect.poll(() => activity.textContent).toContain('Unsplash API error: 401 Unauthorized');
  });

  it('surfaces a network failure', async () => {
    routePhotos(() => Response.error());
    const { activity } = await openUnsplash();

    // Chromium's own message for a fetch that never got a response.
    await expect.poll(() => activity.textContent).toContain('Failed to fetch');
  });

  it('sends the search term when one is typed', async () => {
    routePhotos();
    const { activity } = await openUnsplash();
    await expect.poll(() => photoQueries()).toHaveLength(1);

    // Plain markup inside the plugin activity, no test id.
    const input = activity.querySelector('input.search-input') as HTMLInputElement;
    await userEvent.fill(input, 'cats');
    await userEvent.keyboard('{Enter}');

    await expect.poll(() => photoQueries()).toHaveLength(2);
    expect(photoQueries()[0].has('query')).toBe(false);
    expect(photoQueries()[1].get('query')).toBe('cats');
  });

  it('adds the picked photo to the collection', async () => {
    routePhotos();
    const { activity, api } = await openUnsplash();

    await expect.poll(() => activity.querySelectorAll('img').length).toBeGreaterThan(0);
    await userEvent.click(activity.querySelector('img') as HTMLElement);

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
    const [entry] = api.getOutputCollectionState().allEntries;
    expect(entry.name).toBe(`unsplash-${PHOTO.id}.jpg`);
    expect(entry.externalUrl).toBe(PHOTO.urls.full);
  });
});
