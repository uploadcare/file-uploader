/**
 * @param {File} file
 * @returns {Promise<boolean>}
 */
function checkIsDirectory(file) {
  return new Promise((resolve) => {
    if (typeof window.FileReader !== 'function') {
      resolve(false);
    }

    try {
      let reader = new FileReader();
      reader.onerror = () => {
        resolve(true);
      };
      let onLoad = (e) => {
        if (e.type !== 'loadend') {
          reader.abort();
        }
        resolve(false);
      };
      reader.onloadend = onLoad;
      reader.onprogress = onLoad;

      reader.readAsDataURL(file);
    } catch (err) {
      resolve(false);
    }
  });
}

function readEntryContentAsync(webkitEntry) {
  return new Promise((resolve, reject) => {
    let reading = 0;
    let contents = [];

    let readEntry = (entry) => {
      if (!entry) {
        console.warn('Unexpectedly received empty content entry', { scope: 'drag-and-drop' });
        resolve(null);
      }
      if (entry.isFile) {
        reading++;
        entry.file((file) => {
          reading--;
          contents.push(file);

          if (reading === 0) {
            resolve(contents);
          }
        });
      } else if (entry.isDirectory) {
        readReaderContent(entry.createReader());
      }
    };

    let readReaderContent = (reader) => {
      reading++;

      reader.readEntries((entries) => {
        reading--;
        for (let entry of entries) {
          readEntry(entry);
        }

        if (reading === 0) {
          resolve(contents);
        }
      });
    };

    readEntry(webkitEntry);
  });
}

/**
 * Note: dataTransfer will be destroyed outside of the call stack. So, do not try to process it asynchronous.
 *
 * @param {DataTransfer} dataTransfer
 * @returns {Promise<File[]>}
 */
export function getDropFiles(dataTransfer) {
  let files = [];
  let promises = [];
  for (let i = 0; i < dataTransfer.items.length; i++) {
    let item = dataTransfer.items[i];
    if (item && item.kind === 'file') {
      if (typeof item.webkitGetAsEntry === 'function' || typeof (/** @type {any} */ (item).getAsEntry) === 'function') {
        let entry =
          typeof item.webkitGetAsEntry === 'function'
            ? item.webkitGetAsEntry()
            : /** @type {any} */ (item).getAsEntry();
        promises.push(
          readEntryContentAsync(entry).then((entryContent) => {
            files.push(...entryContent);
          })
        );
        continue;
      }

      let file = item.getAsFile();
      promises.push(
        checkIsDirectory(file).then((isDirectory) => {
          if (isDirectory) {
            // we can't get directory files, so we'll skip it
          } else {
            files.push(file);
          }
        })
      );
    }
  }

  return Promise.all(promises).then(() => files);
}
