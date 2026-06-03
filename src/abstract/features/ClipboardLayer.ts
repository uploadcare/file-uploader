import { ACTIVITY_TYPES } from '../../lit/activity-constants';
import { SharedInstance, type SharedInstancesBag } from '../../lit/shared-instances';

export type PasteScope = 'local' | 'global' | false;

const ALLOWED_PASTE_ACTIVITIES = new Set<string>([ACTIVITY_TYPES.START_FROM, ACTIVITY_TYPES.UPLOAD_LIST]);

export class ClipboardLayer extends SharedInstance {
  private scopes: Set<Node> = new Set();
  private listener: (event: ClipboardEvent) => void;

  public constructor(sharedInstancesBag: SharedInstancesBag) {
    super(sharedInstancesBag);

    this.listener = this._listener.bind(this);
    window.addEventListener('paste', this.listener);
  }

  private _isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      return false;
    }

    if (target.closest('input, textarea, select')) {
      return true;
    }

    const editableElement = target.closest('[contenteditable]');
    if (editableElement && editableElement.getAttribute('contenteditable')?.toLowerCase() !== 'false') {
      return true;
    }

    if (target.closest('[role="textbox"], [role="searchbox"], [role="combobox"]')) {
      return true;
    }

    return false;
  }

  private _isEditablePaste(event: ClipboardEvent): boolean {
    return event.composedPath().some((target) => this._isEditableTarget(target));
  }

  private _isAllowedPasteActivity(activity: unknown): boolean {
    return typeof activity === 'string' && ALLOWED_PASTE_ACTIVITIES.has(activity);
  }

  private _hasConnectedScope(): boolean {
    return [...this.scopes].some((scope) => scope.isConnected);
  }

  private _hasRegularSolutionScope(): boolean {
    return [...this.scopes].some((scope) => {
      return scope.isConnected && scope instanceof Element && scope.localName === 'uc-file-uploader-regular';
    });
  }

  private _isInsideScope(target: Node | null): boolean {
    if (!target) {
      return false;
    }

    return [...this.scopes].some((scope) => scope.isConnected && scope.contains(target));
  }

  private _getPastedUrl(text: string): string | null {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return null;
    }

    try {
      const url = new URL(trimmedText);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  private openUploadList() {
    this._sharedInstancesBag.routerLayer.navigateAfterFileAdd();
  }

  private async _listener(event: ClipboardEvent) {
    if (!event.clipboardData) {
      return;
    }

    if (this._isEditablePaste(event)) {
      return;
    }

    if (!this._hasConnectedScope()) {
      return;
    }

    const currentActivity = this._sharedInstancesBag.ctx.read('*currentActivity');
    const isInitialState = currentActivity === null;
    const isAllowedActivity = this._isAllowedPasteActivity(currentActivity);

    switch (this._cfg.pasteScope) {
      case 'global':
        if (!isAllowedActivity && !(isInitialState && this._hasRegularSolutionScope())) {
          return;
        }
        await this.handlePaste(event);
        return;
      case 'local': {
        const target = event.target instanceof Node ? event.target : null;
        if (!this._isInsideScope(target) || (!isAllowedActivity && !isInitialState)) {
          return;
        }
        await this.handlePaste(event);
        return;
      }
      default:
        return;
    }
  }

  private async handlePaste(event: ClipboardEvent) {
    if (!event.clipboardData) {
      return;
    }
    const items = Array.from(event.clipboardData.items);

    const files = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    const urlItems = items
      .filter((item) => item.kind === 'string' && (item.type === 'text/plain' || item.type === 'text/uri-list'))
      .map((item) => {
        return new Promise<string | null>((resolve) => {
          item.getAsString((text) => {
            resolve(this._getPastedUrl(text));
          });
        });
      });

    let hasAddedFiles = false;

    if (files.length > 0) {
      files.forEach((file) => {
        this._sharedInstancesBag.api.addFileFromObject(file, { source: 'clipboard' });
      });
      hasAddedFiles = true;
    }

    if (urlItems.length > 0) {
      const resolvedUrls = (await Promise.all(urlItems)).filter((url): url is string => url !== null);
      resolvedUrls.forEach((url) => {
        this._sharedInstancesBag.api.addFileFromUrl(url, { source: 'clipboard' });
      });
      hasAddedFiles ||= resolvedUrls.length > 0;
    }

    if (hasAddedFiles) {
      this.openUploadList();
    }
  }

  public registerBlock(scope: Node) {
    this.scopes.add(scope);

    return () => {
      this.scopes.delete(scope);
    };
  }

  public override destroy(): void {
    super.destroy();

    window.removeEventListener('paste', this.listener);
    this.scopes.clear();
  }
}
