import { logger } from '../../abstract/logger';

const log = logger.scope('drop-items');

export type DropItem =
  | {
      type: 'file';
      file: File;
      fullPath?: string;
    }
  | {
      type: 'url';
      url: string;
    };

function checkIsDirectory(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => {
        resolve(true);
      };
      const onLoad = (event: ProgressEvent<FileReader>) => {
        if (event.type !== 'loadend') {
          reader.abort();
        }
        resolve(false);
      };
      reader.onloadend = onLoad;
      reader.onprogress = onLoad;

      reader.readAsDataURL(file);
    } catch {
      resolve(false);
    }
  });
}

const readFile = (entry: FileSystemFileEntry): Promise<File | null> =>
  new Promise((resolve) => entry.file(resolve, () => resolve(null)));

/** One batch of a directory listing; an empty batch means the listing is done (or could not be read). */
const readBatch = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
  new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));

async function readEntryContent(entry: FileSystemEntry | null, dataTransferItemType: string): Promise<DropItem[]> {
  if (!entry) {
    log.warn('Unexpectedly received empty content entry', { scope: 'drag-and-drop' });
    return [];
  }
  if (entry.isFile) {
    const file = await readFile(entry as FileSystemFileEntry);
    if (!file) {
      log.warn('Could not read a dropped file', { scope: 'drag-and-drop', path: entry.fullPath });
      return [];
    }
    // webkitGetAsEntry don't provide type for HEIC images at least, so we use type value from dataTransferItem
    const clonedFile = new File([file], file.name, { type: file.type || dataTransferItemType });
    return [{ type: 'file', file: clonedFile, fullPath: entry.fullPath }];
  }
  if (!entry.isDirectory) {
    return [];
  }
  // `readEntries` hands out a directory in batches (100 at most in Chromium) until it returns an empty one.
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const dropItems: DropItem[] = [];
  for (let batch = await readBatch(reader); batch.length > 0; batch = await readBatch(reader)) {
    const children = await Promise.all(batch.map((child) => readEntryContent(child, dataTransferItemType)));
    dropItems.push(...children.flat());
  }
  return dropItems;
}

/**
 * Note: dataTransfer will be destroyed outside of the call stack. So, do not try to process it asynchronous.
 */
export function getDropItems(dataTransfer: DataTransfer): Promise<DropItem[]> {
  const dropItems: DropItem[] = [];
  const promises: Array<Promise<void>> = [];
  for (let i = 0; i < dataTransfer.items.length; i++) {
    const item = dataTransfer.items[i];
    if (!item) {
      continue;
    }
    if (item.kind === 'file') {
      const itemType = item.type;
      const withEntry = item as DataTransferItem & {
        webkitGetAsEntry?: () => FileSystemEntry;
        getAsEntry?: () => FileSystemEntry;
      };
      if (typeof withEntry.webkitGetAsEntry === 'function' || typeof withEntry.getAsEntry === 'function') {
        const entry =
          typeof withEntry.webkitGetAsEntry === 'function' ? withEntry.webkitGetAsEntry() : withEntry.getAsEntry?.();
        if (entry) {
          promises.push(
            readEntryContent(entry, itemType).then((items) => {
              dropItems.push(...items);
            }),
          );
        }
        continue;
      }

      const file = item.getAsFile();
      if (file) {
        promises.push(
          checkIsDirectory(file).then((isDirectory) => {
            if (!isDirectory) {
              dropItems.push({
                type: 'file',
                file,
              });
            }
          }),
        );
      }
    } else if (item.kind === 'string' && /^text\/uri-list/.test(item.type)) {
      promises.push(
        new Promise<void>((resolve) => {
          item.getAsString((value) => {
            dropItems.push({
              type: 'url',
              url: value,
            });
            resolve();
          });
        }),
      );
    }
  }

  return Promise.all(promises).then(() => dropItems);
}
