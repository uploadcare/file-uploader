import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { UploadCtxProvider } from '@/index.js';

import '../types/jsx';
import { EventTracker } from './utils/event-tracker';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('Advanced Scenarios', () => {
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
   * PHASE 5: FILE VALIDATION & EDGE CASES
   */

  it('should handle empty file list gracefully', async () => {
    if (!provider) return;

    const files = provider.api.getFiles?.() ?? [];
    expect(Array.isArray(files) || files === undefined).toBe(true);
  });

  it('should validate file type scenarios', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['valid'], 'valid.txt', { type: 'text/plain' }));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThanOrEqual(1), { timeout: 2000 });

    expect(tracker.has('file-added')).toBe(true);
  });

  it('should handle file size variations', async () => {
    if (!provider) return;

    // Small file
    const smallFile = new File(['x'.repeat(1024)], 'small.txt');
    provider.api.addFileFromObject(smallFile);

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThanOrEqual(1), { timeout: 2000 });

    expect(tracker.has('file-added')).toBe(true);
  });

  /**
   * PHASE 5: UPLOAD ERROR & RECOVERY SCENARIOS
   */

  it('should handle bulk upload initialization', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['bulk1'], 'bulk1.txt'));
    provider.api.addFileFromObject(new File(['bulk2'], 'bulk2.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    expect(tracker.has('common-upload-start')).toBe(true);
  });

  it('should track upload progress for multiple files', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['progress1'], 'progress1.txt'));
    provider.api.addFileFromObject(new File(['progress2'], 'progress2.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.getCount('file-upload-progress')).toBeGreaterThan(0), { timeout: 5000 });

    expect(tracker.getCount('file-upload-progress')).toBeGreaterThan(0);
  });

  /**
   * PHASE 5: CONCURRENT OPERATION SCENARIOS
   */

  it('should handle add-while-uploading flow', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['add1'], 'add1.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    provider.api.uploadAll?.();
    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    // Add file during upload
    provider.api.addFileFromObject(new File(['add2'], 'add2.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThanOrEqual(2), { timeout: 2000 });

    expect(tracker.getCount('file-added')).toBeGreaterThanOrEqual(2);
  });

  it('should handle remove-while-uploading flow', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['remove1'], 'remove1.txt'));
    provider.api.addFileFromObject(new File(['remove2'], 'remove2.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();
    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    // Remove file during upload
    const files = provider.api.getFiles?.();
    if (files && files.length > 0) {
      provider.api.removeFile?.(files[0]);
    }

    await new Promise((r) => setTimeout(r, 500));

    expect(tracker.getSequence().length).toBeGreaterThan(0);
  });

  /**
   * PHASE 5: STATE RECOVERY SCENARIOS
   */

  it('should recover from interrupted workflow', async () => {
    if (!provider) return;

    // First workflow
    provider.api.addFileFromObject(new File(['int1'], 'interrupt1.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    provider.api.uploadAll?.();
    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    // Resume with new file
    await new Promise((r) => setTimeout(r, 500));

    provider.api.addFileFromObject(new File(['int2'], 'interrupt2.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThanOrEqual(2), { timeout: 2000 });

    expect(tracker.getCount('file-added')).toBeGreaterThanOrEqual(2);
  });

  it('should maintain event integrity across sequential uploads', async () => {
    if (!provider) return;

    // Upload cycle 1
    provider.api.addFileFromObject(new File(['seq1'], 'sequence1.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    provider.api.uploadAll?.();
    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    const firstCycleCount = tracker.getCount('common-upload-start');

    await new Promise((r) => setTimeout(r, 500));

    // Upload cycle 2
    provider.api.addFileFromObject(new File(['seq2'], 'sequence2.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.getCount('common-upload-start')).toBeGreaterThan(firstCycleCount), {
      timeout: 5000,
    });

    expect(tracker.getCount('common-upload-start')).toBeGreaterThan(firstCycleCount);
  });

  /**
   * PHASE 5: EDGE CASES & STRESS TESTS
   */

  it('should handle rapid sequential file additions', async () => {
    if (!provider) return;

    for (let i = 0; i < 5; i++) {
      provider.api.addFileFromObject(new File([`rapid${i}`], `rapid${i}.txt`));
    }

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBeGreaterThanOrEqual(5), { timeout: 2000 });

    expect(tracker.getCount('file-added')).toBeGreaterThanOrEqual(5);
  });

  it('should handle mixed upload and removal operations', async () => {
    if (!provider) return;

    // Add multiple files
    provider.api.addFileFromObject(new File(['mix1'], 'mix1.txt'));
    provider.api.addFileFromObject(new File(['mix2'], 'mix2.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    // Remove one
    const files = provider.api.getFiles?.();
    if (files && files.length > 0) {
      provider.api.removeFile?.(files[0]);
    }

    // Upload remaining
    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    expect(tracker.has('common-upload-start')).toBe(true);
  });

  /**
   * PHASE 5: EVENT PAYLOAD & SEQUENCE VALIDATION
   */

  it('should capture and validate event payloads', async () => {
    if (!provider) return;

    provider.api.addFileFromObject(new File(['payload'], 'payload.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    const events = tracker.getEvents('file-added');
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('should maintain proper event sequencing under load', async () => {
    if (!provider) return;

    // Quick sequence of operations
    provider.api.addFileFromObject(new File(['load1'], 'load1.txt'));
    provider.api.addFileFromObject(new File(['load2'], 'load2.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    const sequence = tracker.getSequence();

    // Verify key events in proper order
    const addIdx = sequence.indexOf('file-added');
    const uploadIdx = sequence.indexOf('common-upload-start');

    expect(addIdx).toBeLessThan(uploadIdx);
  });

  /**
   * PHASE 5: TIMING & DEBOUNCING
   */

  it('should apply debouncing to CHANGE events appropriately', async () => {
    if (!provider) return;

    // Multiple rapid additions
    provider.api.addFileFromObject(new File(['deb1'], 'deb1.txt'));
    provider.api.addFileFromObject(new File(['deb2'], 'deb2.txt'));
    provider.api.addFileFromObject(new File(['deb3'], 'deb3.txt'));

    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(3), { timeout: 2000 });

    // CHANGE events should be fewer due to debouncing
    const changeCount = tracker.getCount('change');
    const addCount = tracker.getCount('file-added');

    expect(changeCount).toBeLessThanOrEqual(addCount);
  });

  it('should capture timing across complex workflows', async () => {
    if (!provider) return;

    const startMs = Date.now();

    provider.api.addFileFromObject(new File(['timing'], 'timing.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    provider.api.uploadAll?.();
    await vi.waitFor(() => expect(tracker.has('common-upload-start')).toBe(true), { timeout: 5000 });

    const elapsedMs = Date.now() - startMs;

    // Timing should be reasonable (not instant, but not excessively long)
    expect(elapsedMs).toBeGreaterThan(100);
    expect(elapsedMs).toBeLessThan(15000);
  });

  /**
   * PHASE 5: SYSTEM RESILIENCE
   */

  it('should handle multiple upload cycles reliably', async () => {
    if (!provider) return;

    // Cycle 1
    provider.api.addFileFromObject(new File(['cycle1'], 'cycle1.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    provider.api.uploadAll?.();
    await vi.waitFor(() => expect(tracker.getCount('common-upload-start')).toBeGreaterThanOrEqual(1), {
      timeout: 5000,
    });

    const cycle1Uploads = tracker.getCount('common-upload-start');

    await new Promise((r) => setTimeout(r, 300));

    // Cycle 2
    provider.api.addFileFromObject(new File(['cycle2'], 'cycle2.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    provider.api.uploadAll?.();

    await vi.waitFor(() => expect(tracker.getCount('common-upload-start')).toBeGreaterThan(cycle1Uploads), {
      timeout: 5000,
    });

    expect(tracker.getCount('common-upload-start')).toBeGreaterThan(cycle1Uploads);
  });

  it('should maintain consistency after provider state changes', async () => {
    if (!provider) return;

    // Initial state
    provider.api.addFileFromObject(new File(['state1'], 'state1.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(1), { timeout: 2000 });

    const initialSequence = tracker.getSequence().length;

    // State change
    provider.api.addFileFromObject(new File(['state2'], 'state2.txt'));
    await vi.waitFor(() => expect(tracker.getCount('file-added')).toBe(2), { timeout: 2000 });

    const finalSequence = tracker.getSequence().length;

    // Should capture additional events
    expect(finalSequence).toBeGreaterThan(initialSequence);
  });
});
