import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import { lifetimeOf } from '../abstract/di/ControllerContainer';
import { inject } from '../abstract/di/inject';
import type { UploadEntryTypedData } from '../abstract/uploadEntrySchema';
import { generateThumb } from '../utils/resizeImage';
import { queueThumbnail } from '../utils/thumbnail-queue';

/** One entry's thumbnail being drawn. Counts the thumb behind `signal` among those waiting for it, until it aborts. */
type Drawing = (signal: AbortSignal) => Promise<void>;

/**
 * The thumbnails of one uploader's entries. A thumbnail belongs to its entry, not to the `<uc-thumb>` showing it: a
 * row scrolled out of the list's window and back in is a new element for the same entry, and the primary action button
 * shows the file its row shows. So the work in flight and the object URLs are held here, once per entry, and a thumb
 * only asks and displays.
 *
 * Container-resolved, in `src/lit` because drawing needs the DOM (`generateThumb`).
 */
export class ThumbnailController {
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;

  private readonly _drawing = new Map<UploadEntryTypedData, Drawing>();
  /** The object URLs among the thumbnails stored on entries: this is their only owner, so the only one to revoke them. */
  private readonly _urls = new Set<string>();

  /** Runs once the container built this instance, since `@inject` does not resolve inside a constructor. */
  public init(): void {
    this._collection.observeCollection((_list, _added, removed) => {
      for (const entry of removed) this._revoke(entry.get('thumbUrl'));
    });
  }

  private _revoke(url: string | null): void {
    if (url && this._urls.delete(url)) URL.revokeObjectURL(url);
  }

  /**
   * Make `url` the entry's thumbnail and release the one it replaces. An object URL is owned from here on. One that
   * arrives after its entry was removed, or after the uploader was destroyed, is released at once: nothing is left to
   * show it, and the removal has already released what the entry had.
   */
  public store(entry: UploadEntryTypedData, url: string): void {
    if (url.startsWith('blob:')) this._urls.add(url);
    // The lifetime first: the collection cannot be read once the container is disposed.
    if (lifetimeOf(this).signal.aborted || this._collection.read(entry.uid) !== entry) {
      this._revoke(url);
      return;
    }
    const replaced = entry.get('thumbUrl');
    entry.set('thumbUrl', url);
    if (replaced !== url) this._revoke(replaced);
  }

  /**
   * Draw the entry's thumbnail from its local `file` and store it: once per entry, however many thumbs ask and
   * whatever size each asks for. Resolves when it is stored, rejects when drawing failed.
   *
   * `signal` is the asking thumb's adoption signal. Drawing waits in the page's queue (`queueThumbnail`); it is
   * dropped from there, rejecting with the abort, once every thumb that asked is gone, and stays while one still
   * waits. Once started it finishes and is stored, for the next thumb of that entry to show.
   */
  public draw(entry: UploadEntryTypedData, file: Blob, size: number, signal: AbortSignal): Promise<void> {
    let drawing = this._drawing.get(entry);
    if (!drawing) {
      const abort = new AbortController();
      let waiting = 0;
      let started = false;
      const done = queueThumbnail(() => {
        started = true;
        return generateThumb(file, size);
      }, abort.signal)
        .then((url) => this.store(entry, url))
        .finally(() => {
          if (this._drawing.get(entry) === added) this._drawing.delete(entry);
        });
      const added: Drawing = (asker) => {
        waiting++;
        asker.addEventListener('abort', () => {
          if (--waiting || started) return;
          // Forgotten now, not when the queue's rejection settles: a thumb re-adopted in this same task asks anew.
          this._drawing.delete(entry);
          abort.abort();
        });
        return done;
      };
      drawing = added;
      this._drawing.set(entry, added);
    }
    return drawing(signal);
  }
}
