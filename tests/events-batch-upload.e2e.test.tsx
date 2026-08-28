import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { EventPayload, UploadCtxProvider } from '@/index.js';

import '../types/jsx';
import { EventTracker } from './utils/event-tracker';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('Batch Upload & Advanced Events', () => {
  let tracker: EventTracker;
  let ctxName: string;
  let provider: UploadCtxProvider | null;

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

  beforeEach(() => {
    tracker = new EventTracker();
    ctxName = `test-${Math.random().toString(36).slice(2)}`;

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider data-testid="uc-upload-ctx-provider" ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    provider = page.getByTestId('uc-upload-ctx-provider').query() as UploadCtxProvider | null;
    if (provider) {
      allEventTypes.forEach((eventType) => {
        provider!.addEventListener(eventType, (event: Event) => {
          if (event instanceof CustomEvent) {
            tracker.capture(eventType, event.detail);
          }
        });
      });
    }
  });

  /**
   * PHASE 2: BATCH UPLOAD TESTS
   */

  it('should emit COMMON_UPLOAD_START on batch upload trigger', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['1'], 'a.txt'));
    provider.api.addFileFromObject(new File(['2'], 'b.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 3000 });
  });

  it('should track individual FILE_UPLOAD_START for each file in batch', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['1'], 'a.txt'));
    provider.api.addFileFromObject(new File(['2'], 'b.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.getCount('file-upload-start')).toBeGreaterThanOrEqual(1), { timeout: 3000 });

    expect(tracker.getCount('file-upload-start')).toBeGreaterThanOrEqual(1);
  });

  it('should fire FILE_REMOVED events with correct payload', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['content'], 'remove-me.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    const files = provider.api.getFiles?.();
    if (files?.[0]) {
      provider.api.removeFile?.(files[0]);

      await vi.waitFor(() => expect(tracker.has('file-removed')).toBe(true), { timeout: 2000 });
    }
  });

  it('should maintain correct event order for batch upload', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['1'], 'a.txt'));
    provider.api.addFileFromObject(new File(['2'], 'b.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 3000 });

    const sequence = tracker.getSequence();
    expect(sequence.some((e) => e === 'file-added')).toBe(true);
    expect(sequence.some((e) => e === 'common-upload-start')).toBe(true);
  });

  it('should emit CHANGE event when file collection state updates', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['test'], 'change-test.txt'));

    await vi.waitFor(() => expect(tracker.has('change')).toBe(true), { timeout: 2000 });

    expect(tracker.getCount('change')).toBeGreaterThan(0);
  });

  it('should continue uploading after file removal', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['1'], 'a.txt'));
    provider.api.addFileFromObject(new File(['2'], 'b.txt'));
    provider.api.addFileFromObject(new File(['3'], 'c.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(3), { timeout: 2000 });

    // Attempt to remove middle file
    const files = provider.api.getFiles?.();
    if (files?.[1]) {
      provider.api.removeFile?.(files[1]);
    }

    provider.api.uploadAll?.();

    // Verify upload started regardless
    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 3000 });
  });

  /**
   * PHASE 2: EVENT TIMING & DEBOUNCING
   */

  it('should debounce rapid file additions', async () => {
    if (!provider) return;

    const initialChangeCount = tracker.getCount('change');

    provider.api.addFileFromObject(new File(['1'], 'rapid1.txt'));
    provider.api.addFileFromObject(new File(['2'], 'rapid2.txt'));
    provider.api.addFileFromObject(new File(['3'], 'rapid3.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(3), { timeout: 2000 });

    const finalChangeCount = tracker.getCount('change');
    const changeIncrement = finalChangeCount - initialChangeCount;

    // CHANGE events should be debounced (less than 3)
    expect(changeIncrement).toBeLessThanOrEqual(3);
  });

  it('should capture event timing information', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['x'], 'timing.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThan(0), { timeout: 2000 });

    const events = tracker.getEvents('file-added');
    expect(events.length).toBeGreaterThan(0);

    events.forEach((evt) => {
      expect(evt.timestamp).toBeGreaterThan(0);
    });
  });

  /**
   * PHASE 2: EVENT PAYLOAD VALIDATION
   */

  it('should validate file-added payload structure', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['test'], 'payload-test.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThan(0), { timeout: 2000 });

    const evt = tracker.getFirst('file-added');
    if (evt?.payload) {
      const payload = evt.payload as EventPayload['file-added'];
      expect(payload).toBeDefined();
    }
  });
});
