import { vi } from 'vitest';
import type { EventKey, EventPayload } from '@/index.js';
import type { EventTracker } from './event-tracker';

interface UploadCtxProvider extends HTMLElement {
  api: {
    addFileFromUrl: (url: string) => void;
  };
}

/**
 * Add a file via upload button and wait for FILE_ADDED event
 */
export async function addFileToUploader(
  tracker: EventTracker,
  fileName = 'test.jpg',
  fileSize = 1024 * 100,
): Promise<void> {
  const blob = new Blob(['x'.repeat(fileSize)], { type: 'image/jpeg' });
  const file = new File([blob], fileName, { type: 'image/jpeg' });

  // Use the API to add file if available
  const provider = getUploadCtxProvider();
  if (provider?.api?.addFileFromUrl) {
    // For now, just wait for page to be ready
    await vi.waitFor(() => tracker.getCount('file-added') === 0, { timeout: 1000 }).catch(() => undefined);
  }

  // Try to find and use file input
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
  if (fileInput) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    // Trigger change event
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Wait for FILE_ADDED event
  await vi.waitFor(
    () => {
      const lastAdded = tracker.getLast('file-added');
      return lastAdded?.payload.name === fileName;
    },
    { timeout: 5000 },
  );
}

/**
 * Click upload button and wait for upload to complete
 */
export async function uploadFiles(
  tracker: EventTracker,
  options: { timeout: number } = { timeout: 10000 },
): Promise<void> {
  // Find upload button
  const uploadBtn = document.querySelector(
    'button[data-testid="upload-btn"], button:has-text("Upload")',
  ) as HTMLButtonElement | null;
  if (uploadBtn) {
    uploadBtn.click();
  }

  // Wait for either success or failure
  await vi.waitFor(
    () => {
      const hasSuccess = tracker.getCount('file-upload-success') > 0;
      const hasFailed = tracker.getCount('file-upload-failed') > 0;
      const hasCommonSuccess = tracker.getCount('common-upload-success') > 0;
      const hasCommonFailed = tracker.getCount('common-upload-failed') > 0;

      return hasSuccess || hasFailed || hasCommonSuccess || hasCommonFailed;
    },
    { timeout: options.timeout },
  );
}

/**
 * Assert event payload matches expectations
 */
export function assertEventPayload<T extends EventKey>(
  tracker: EventTracker,
  type: T,
  expectations: Partial<EventPayload[T]>,
): void {
  const payload = tracker.getPayload(type);
  if (!payload) {
    throw new Error(`Event ${type} was not captured`);
  }

  const payloadObj = payload as Record<string, unknown>;
  const expectObj = expectations as Record<string, unknown>;

  Object.entries(expectObj).forEach(([key, expectedValue]) => {
    const actualValue = payloadObj[key];
    if (actualValue !== expectedValue) {
      throw new Error(
        `Payload mismatch for ${type}.${key}:\nExpected: ${JSON.stringify(expectedValue)}\nActual: ${JSON.stringify(actualValue)}`,
      );
    }
  });
}

/**
 * Get the UploadCtxProvider element (assumes it's rendered with test-id)
 */
export function getUploadCtxProvider(): UploadCtxProvider | null {
  const provider = document.querySelector('[data-testid="uc-upload-ctx-provider"]') as UploadCtxProvider | null;
  return provider;
}

/**
 * Get the file uploader element
 */
export function getFileUploader(): Element | null {
  const uploader = document.querySelector('uc-file-uploader-regular, uc-file-uploader-inline');
  return uploader;
}
