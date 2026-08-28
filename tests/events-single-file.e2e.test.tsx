import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { UploadCtxProvider } from '@/index.js';

import '../types/jsx';
import { EventTracker } from './utils/event-tracker';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('Single File Upload Events', () => {
  let tracker: EventTracker;
  let ctxName: string;
  let provider: UploadCtxProvider | null;

  beforeEach(() => {
    tracker = new EventTracker();
    ctxName = `test-${Math.random().toString(36).slice(2)}`;

    // Render uploader components
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider data-testid="uc-upload-ctx-provider" ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    // Get provider and attach event listeners
    provider = page.getByTestId('uc-upload-ctx-provider').query() as UploadCtxProvider | null;
    if (provider) {
      // Listen to all events and capture them
      const allEventTypes = [
        'file-added',
        'file-removed',
        'file-upload-start',
        'file-upload-progress',
        'file-upload-success',
        'file-upload-failed',
        'file-url-changed',
        'modal-open',
        'modal-close',
        'done-click',
        'upload-click',
        'activity-change',
        'common-upload-start',
        'common-upload-progress',
        'common-upload-success',
        'common-upload-failed',
        'change',
        'group-created',
      ] as const;

      allEventTypes.forEach((eventType) => {
        provider!.addEventListener(eventType, (event: Event) => {
          if (event instanceof CustomEvent) {
            tracker.capture(eventType, event.detail);
          }
        });
      });
    }
  });

  it('should capture FILE_ADDED event when file is added via API', async () => {
    expect(provider).toBeDefined();

    if (provider) {
      provider.api.addFileFromObject(new File(['test content'], 'test.txt', { type: 'text/plain' }));

      await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThan(0), { timeout: 2000 });

      expect(tracker.has('file-added')).toBe(true);
    }
  });

  it('should emit events in correct sequence for file addition', async () => {
    if (provider) {
      provider.api.addFileFromObject(new File(['content'], 'file.txt'));

      await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThan(0), { timeout: 2000 });

      const sequence = tracker.getSequence();
      expect(sequence).toContain('file-added');
    }
  });

  it('should track multiple FILE_ADDED events for multiple files', async () => {
    if (provider) {
      provider.api.addFileFromObject(new File(['1'], 'a.txt'));
      provider.api.addFileFromObject(new File(['2'], 'b.txt'));

      await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });
    }
  });

  it('should emit CHANGE event on state updates', async () => {
    if (provider) {
      provider.api.addFileFromObject(new File(['x'], 'change.txt'));

      await vi.waitFor(() => expect(tracker.getCount('change')).toBeGreaterThan(0), { timeout: 2000 });
    }
  });

  it('should maintain event sequence with debug info on failure', async () => {
    if (provider) {
      provider.api.addFileFromObject(new File(['debug test'], 'debug.txt'));

      await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThan(0), { timeout: 2000 });

      const debug = tracker.debug();
      expect(debug.length).toBeGreaterThan(0);
      expect(debug).toContain('file-added');
    }
  });
});
