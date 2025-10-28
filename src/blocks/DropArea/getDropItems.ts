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
    if (typeof window.FileReader !== 'function') {
      resolve(false);
    }

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

function readEntryContentAsync(webkitEntry: FileSystemEntry, dataTransferItemType: string): Promise<DropItem[] | null> {
  return new Promise((resolve) => {
    let reading = 0;
    const dropItems: DropItem[] = [];

    const readEntry = (entry: FileSystemEntry | null) => {
      if (!entry) {
        console.warn('Unexpectedly received empty content entry', { scope: 'drag-and-drop' });
        resolve(null);
        return;
      }
      if (entry.isFile) {
        reading++;
        (entry as FileSystemFileEntry).file((file) => {
          reading--;
          // webkitGetAsEntry don't provide type for HEIC images at least, so we use type value from dataTransferItem
          const clonedFile = new File([file], file.name, { type: file.type || dataTransferItemType });
          dropItems.push({
            type: 'file',
            file: clonedFile,
            fullPath: entry.fullPath,
          });

          if (reading === 0) {
            resolve(dropItems);
          }
        });
      } else if (entry.isDirectory) {
        readReaderContent((entry as FileSystemDirectoryEntry).createReader());
      }
    };

    const readReaderContent = (reader: FileSystemDirectoryReader) => {
      reading++;

      reader.readEntries((entries) => {
        reading--;
        for (const entry of entries) {
          readEntry(entry);
        }

        if (reading === 0) {
          resolve(dropItems);
        }
      });
    };

    readEntry(webkitEntry);
  });
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
            readEntryContentAsync(entry, itemType).then((items) => {
              if (items) {
                dropItems.push(...items);
              }
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
