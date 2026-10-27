import { describe, expect, it, vi } from 'vitest';
import type { Config } from '@/index';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/** `cameraVideoFormats` against chromium's fake camera, which records WebM and MP4. */

/** The options every recorder is created with, by wrapping the real `MediaRecorder`. */
const spyOnRecorderOptions = () => {
  const options: (MediaRecorderOptions | undefined)[] = [];
  const Original = window.MediaRecorder;
  vi.stubGlobal(
    'MediaRecorder',
    class extends Original {
      public constructor(stream: MediaStream, init?: MediaRecorderOptions) {
        super(stream, init);
        options.push(init);
      }
    },
  );
  return options;
};

/** Opens the camera, records about a second of video, accepts it and returns its file type and name. */
const recordClip = async (configProps: Partial<Config> = {}) => {
  const { api, root } = await renderSolution('regular', configProps);
  api.initFlow();
  await expectActivity(root, 'start-from');
  await within(root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();
  await expectActivity(root, 'camera');

  const camera = within(root).getByTestId('uc-camera-source');
  const shot = camera.getByRole('button', { name: 'Shot', exact: true });
  await expect.element(shot, { timeout: 20_000 }).toBeVisible();
  await camera.getByRole('button', { name: 'Video', exact: true }).click();
  await shot.click();
  const timer = camera.getByTestId('uc-camera-source--recording-timer');
  await expect.poll(() => timer.element().textContent?.trim(), { timeout: 10_000 }).toMatch(/00:0[1-9]/);
  await shot.click();
  await camera.getByRole('button', { name: 'Accept', exact: true }).click();

  await expect.poll(() => api.getOutputCollectionState().totalCount, { timeout: 20_000 }).toBe(1);
  const [entry] = api.getOutputCollectionState().allEntries;
  if (!entry.file) throw new Error('The video entry has no file');
  return { type: entry.file.type, name: entry.name };
};

describe('cameraVideoFormats', () => {
  it('records WebM by default', async () => {
    const clip = await recordClip();

    expect(clip.type).toBe('video/webm');
    expect(clip.name).toMatch(/^video-\d+\.webm$/);
  });

  it('records MP4 with H.264 + AAC when mp4 comes first', async () => {
    const options = spyOnRecorderOptions();

    const clip = await recordClip({ cameraVideoFormats: 'mp4, webm' });

    expect(clip.type).toBe('video/mp4');
    expect(clip.name).toMatch(/^video-\d+\.mp4$/);
    expect(options.at(-1)?.mimeType).toBe('video/mp4;codecs=avc1,mp4a.40.2');
  });

  it('lets a supported mediaRecorderOptions.mimeType win', async () => {
    const clip = await recordClip({ cameraVideoFormats: 'mp4', mediaRecorderOptions: { mimeType: 'video/webm' } });

    expect(clip.type).toBe('video/webm');
  });

  it('lets the browser choose when nothing listed can be recorded', async () => {
    const options = spyOnRecorderOptions();

    const clip = await recordClip({ cameraVideoFormats: 'video/ogg' });

    expect(options.at(-1)?.mimeType).toBeUndefined();
    expect(clip.type).toMatch(/^video\//);
  });

  it('falls back to the default for an unknown format', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const clip = await recordClip({ cameraVideoFormats: 'mov' });

    expect(clip.type).toBe('video/webm');
  });
});
