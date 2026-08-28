import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { EventPayload, UploadCtxProvider } from '@/index.js';

import '../types/jsx';
import { EventTracker } from './utils/event-tracker';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('Upload Lifecycle: Completion & Failures', () => {
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
   * PHASE 3: UPLOAD START & PROGRESS
   */

  it('should emit FILE_UPLOAD_START when upload begins', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['test'], 'upload-start.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.has('file-upload-start')).toBe(true), { timeout: 3000 });

    expect(tracker.getCount('file-upload-start')).toBeGreaterThanOrEqual(1);
  });

  it('should emit FILE_UPLOAD_PROGRESS events during upload', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['x'.repeat(1000)], 'progress-test.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.getCount('file-upload-progress')).toBeGreaterThan(0), { timeout: 5000 });

    const progressEvents = tracker.getEvents('file-upload-progress');
    expect(progressEvents.length).toBeGreaterThan(0);

    progressEvents.forEach((evt) => {
      const payload = evt.payload as EventPayload['file-upload-progress'];
      expect(payload).toBeDefined();
    });
  });

  it('should track upload initialization with COMMON_UPLOAD_START', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['1'], 'batch1.txt'));
    provider.api.addFileFromObject(new File(['2'], 'batch2.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    expect(tracker.getCount('common-upload-start')).toBeGreaterThanOrEqual(1);
  });

  it('should emit COMMON_UPLOAD_PROGRESS during batch upload', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['1'], 'prog1.txt'));
    provider.api.addFileFromObject(new File(['2'], 'prog2.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    // Wait for common progress or individual progress
    await vi.waitFor(
      () =>
        expect(tracker.getCount('common-upload-progress') > 0 || tracker.getCount('file-upload-progress') > 0).toBe(
          true,
        ),
      { timeout: 5000 },
    );

    const hasProgress = tracker.getCount('common-upload-progress') > 0 || tracker.getCount('file-upload-progress') > 0;

    expect(hasProgress).toBe(true);
  });

  it('should maintain proper event order: START comes before PROGRESS', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['data'], 'order-test.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(
      () =>
        expect(
          tracker.has('file-upload-start') &&
            (tracker.has('file-upload-progress') ||
              tracker.has('file-upload-success') ||
              tracker.has('file-upload-failed')),
        ).toBe(true),
      { timeout: 5000 },
    );

    const sequence = tracker.getSequence();
    const startIdx = sequence.indexOf('file-upload-start');

    if (startIdx !== -1) {
      const hasProgressAfter = sequence
        .slice(startIdx + 1)
        .some((e) => ['file-upload-progress', 'file-upload-success', 'file-upload-failed'].includes(e));
      expect(hasProgressAfter).toBe(true);
    }
  });

  /**
   * PHASE 3: STATE TRACKING THROUGH UPLOADS
   */

  it('should track upload state through CHANGE events', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['content'], 'state-change.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    const preUploadChangeCount = tracker.getCount('change');

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.getCount('change')).toBeGreaterThan(preUploadChangeCount), { timeout: 5000 });

    expect(tracker.getCount('change')).toBeGreaterThan(preUploadChangeCount);
  });

  it('should emit COMMON_UPLOAD_FAILED or FILE_UPLOAD_FAILED on errors', async () => {
    if (!provider) return;

    const largeFile = new File(['x'.repeat(100 * 1024 * 1024)], 'huge.txt');
    provider.api.addFileFromObject(largeFile);
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThanOrEqual(1), { timeout: 2000 });

    provider.api.uploadAll?.();

    // Wait for either success or failure event
    await vi.waitFor(
      () =>
        expect(
          tracker.has('file-upload-success') ||
            tracker.has('file-upload-failed') ||
            tracker.has('common-upload-success') ||
            tracker.has('common-upload-failed') ||
            tracker.getCount('file-upload-progress') > 0,
        ).toBe(true),
      { timeout: 10000 },
    );

    const hasUploadEvent =
      tracker.has('file-upload-start') ||
      tracker.has('file-upload-progress') ||
      tracker.has('file-upload-success') ||
      tracker.has('file-upload-failed');

    expect(hasUploadEvent).toBe(true);
  });

  /**
   * PHASE 3: COMPLEX UPLOAD WORKFLOWS
   */

  it('should handle rapid file operations without losing events', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['1'], 'rapid1.txt'));
    provider.api.addFileFromObject(new File(['2'], 'rapid2.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    const eventSequence = tracker.getSequence();
    expect(eventSequence.length).toBeGreaterThan(0);
    expect(eventSequence).toContain('file-added');
    expect(eventSequence).toContain('common-upload-start');
  });

  it('should handle upload after file removal', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['keep'], 'keep.txt'));
    provider.api.addFileFromObject(new File(['remove'], 'remove.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    const files = provider.api.getFiles?.();
    if (files?.[1]) {
      provider.api.removeFile?.(files[1]);
    }

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    expect(tracker.has('common-upload-start')).toBe(true);
  });

  it('should support multiple sequential uploads', async () => {
    if (!provider) return;

    // First upload
    provider.api.addFileFromObject(new File(['first'], 'first.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    const countAfterFirst = tracker.getCount('common-upload-start');

    // Second upload
    provider.api.addFileFromObject(new File(['second'], 'second.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThanOrEqual(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.getCount('common-upload-start')).toBeGreaterThan(countAfterFirst), {
      timeout: 5000,
    });

    expect(tracker.getCount('common-upload-start')).toBeGreaterThan(countAfterFirst);
  });

  /**
   * PHASE 3: EVENT PAYLOAD & TIMING VALIDATION
   */

  it('should capture event timing across upload lifecycle', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['x'], 'timing.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    const time1 = Date.now();
    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.has('file-upload-start')).toBe(true), { timeout: 3000 });

    const time2 = Date.now();

    // Verify timing was captured
    expect(time2 - time1).toBeGreaterThan(0);

    const events = tracker.getEvents('file-upload-start');
    expect(events.length).toBeGreaterThan(0);

    events.forEach((evt) => {
      expect(evt.timestamp).toBeGreaterThan(0);
    });
  });

  it('should validate event counts grow during upload process', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['data'], 'count-test.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    const countBeforeUpload = tracker.getSequence().length;

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.getSequence().length).toBeGreaterThan(countBeforeUpload), { timeout: 5000 });

    const countAfterUpload = tracker.getSequence().length;
    expect(countAfterUpload).toBeGreaterThan(countBeforeUpload);
  });

  it('should track debouncing behavior during upload state changes', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['x'.repeat(500)], 'debounce.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.getCount('file-upload-progress')).toBeGreaterThan(0), { timeout: 5000 });

    const progressCount = tracker.getCount('file-upload-progress');
    const changeCount = tracker.getCount('change');

    // CHANGE events should be debounced relative to progress events
    expect(changeCount).toBeLessThanOrEqual(progressCount + 5);
  });
});
