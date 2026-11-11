import { describe, expect, it, vi } from 'vitest';
import { PreviewVideo } from './PreviewVideo';

const stream = () => new MediaStream();

const setup = () => {
  const taskFailed = vi.fn();
  const runTask = (task: () => unknown) => {
    Promise.resolve()
      .then(task)
      .catch((error: unknown) => taskFailed(error));
  };
  const video = document.createElement('video');
  const play = vi.spyOn(video, 'play').mockResolvedValue();
  vi.spyOn(video, 'pause').mockImplementation(() => {});
  return { preview: new PreviewVideo(runTask), video, play, taskFailed };
};

describe('PreviewVideo', () => {
  it('showClip then showLive restores the live stream muted and detaches clip listeners', () => {
    const { preview, video } = setup();
    const live = stream();
    preview.attach(video);
    preview.show(live);
    const handlers = { onPlay: vi.fn(), onPause: vi.fn() };

    preview.showClip('blob:clip', handlers);
    expect([video.srcObject, video.muted, video.volume]).toEqual([null, false, 1]);
    expect(video.src).toBe('blob:clip');
    video.dispatchEvent(new Event('play'));
    expect(handlers.onPlay).toHaveBeenCalledOnce();

    preview.showLive(live);
    expect([video.srcObject, video.muted]).toEqual([live, true]);
    video.dispatchEvent(new Event('play'));
    video.dispatchEvent(new Event('pause'));
    expect(handlers.onPlay).toHaveBeenCalledOnce();
    expect(handlers.onPause).not.toHaveBeenCalled();
  });

  it('shows a clip from showClip until showLive or close', () => {
    const { preview, video } = setup();
    preview.attach(video);
    const handlers = { onPlay: vi.fn(), onPause: vi.fn() };
    expect(preview.showingClip).toBe(false);

    preview.showClip('blob:clip', handlers);
    expect(preview.showingClip).toBe(true);
    preview.showLive(stream());
    expect(preview.showingClip).toBe(false);

    preview.showClip('blob:clip', handlers);
    preview.close();
    expect(preview.showingClip).toBe(false);
  });

  it('show assigns srcObject only when it changes', () => {
    const { preview, video } = setup();
    const live = stream();
    preview.attach(video);
    const set = vi.fn();
    Object.defineProperty(video, 'srcObject', { get: () => null, set, configurable: true });

    preview.show(live);
    preview.show(live);

    expect(set).toHaveBeenCalledOnce();
  });

  it('attach applies a source set before the element existed', () => {
    const { preview, video } = setup();
    const live = stream();
    preview.show(live);

    preview.attach(video);

    expect(video.srcObject).toBe(live);
    expect(preview.element).toBe(video);
  });

  it('play treats AbortError as superseded', async () => {
    const { preview, video, play, taskFailed } = setup();
    play.mockRejectedValue(new DOMException('interrupted', 'AbortError'));
    preview.attach(video);

    preview.play();
    await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
    await Promise.resolve();

    expect(taskFailed).not.toHaveBeenCalled();
  });

  it('release drops the element', () => {
    const { preview, video } = setup();
    preview.attach(video);
    preview.show(stream());

    preview.release();

    expect(video.srcObject).toBeNull();
    expect(preview.element).toBeUndefined();
    expect(preview.sample()).toBeNull();
  });

  it('a new source clears the frame flag; re-applying the same one keeps it', () => {
    const { preview, video } = setup();
    const live = stream();
    preview.attach(video);
    preview.show(live);
    preview.frame(true);

    preview.show(live);
    preview.attach(video);
    expect(preview.hasVideoFrame).toBe(true);

    preview.show(stream());
    expect(preview.hasVideoFrame).toBe(false);
  });

  it('showing a clip clears the frame flag', () => {
    const { preview, video } = setup();
    preview.attach(video);
    preview.show(stream());
    preview.frame(true);

    preview.showClip('blob:clip', { onPlay: vi.fn(), onPause: vi.fn() });

    expect(preview.hasVideoFrame).toBe(false);
  });

  it('close and release clear the frame flag', () => {
    const { preview, video } = setup();
    preview.attach(video);
    preview.show(stream());
    preview.frame(true);
    preview.close();
    expect(preview.hasVideoFrame).toBe(false);

    preview.show(stream());
    preview.frame(true);
    preview.release();
    expect(preview.hasVideoFrame).toBe(false);
  });
});
