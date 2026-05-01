import { ACTIVITY_TYPES } from '../../lit/activity-constants';
import { findBlockInCtx } from '../../lit/findBlockInCtx';
import { SharedInstance, type SharedInstancesBag } from '../../lit/shared-instances';

export type PasteScope = 'local' | 'global' | false;

export class ClipboardLayer extends SharedInstance {
  private scopes: Set<Node> = new Set();
  private listener: (event: ClipboardEvent) => void;

  public constructor(sharedInstancesBag: SharedInstancesBag) {
    super(sharedInstancesBag);

    this.listener = this._listener.bind(this);
    window.addEventListener('paste', this.listener);
  }

  /**
   * Check if SmartBtn is active by finding the solution block and reading its dynamic property
   */
  private _isSmartBtnActive(): boolean {
    const solutionBlock = findBlockInCtx(
      this._sharedInstancesBag.blocksRegistry,
      (block) => 'isSmartBtnActive' in block,
    ) as { isSmartBtnActive: boolean } | undefined;

    const history = this._sharedInstancesBag.ctx.read('*history');

    return (solutionBlock?.isSmartBtnActive && history.length === 0) ?? false;
  }

  private _excludingNodes(target: Element) {
    if (target.closest('uc-url-source')) {
      return true;
    }

    return false;
  }

  private openUploadList() {
    if (this._isSmartBtnActive()) {
      return;
    }

    this._sharedInstancesBag.api.setCurrentActivity(ACTIVITY_TYPES.UPLOAD_LIST);
    this._sharedInstancesBag.api.setModalState(true);
  }

  private async _listener(event: ClipboardEvent) {
    if (!event.clipboardData) {
      return;
    }

    for (const scope of this.scopes) {
      if (!scope.isConnected) {
        continue;
      }

      if (this._excludingNodes(event.target as Element)) {
        return;
      }

      switch (this._cfg.pasteScope) {
        case 'global':
          await this.handlePaste(event);
          break;
        case 'local':
          if (!scope.contains(event.target as Element)) {
            continue;
          }
          await this.handlePaste(event);
          break;
        default:
          continue;
      }
    }
  }

  private async handlePaste(event: ClipboardEvent) {
    if (!event.clipboardData) {
      return;
    }
    const items = Array.from(event.clipboardData.items);

    const files = items.map((item) => item.getAsFile()).filter((file): file is File => file !== null);
    const urls = items
      .filter((item) => item.kind === 'string' && item.type === 'text/plain')
      .map((item) => {
        return new Promise<string>((resolve) => {
          item.getAsString((text) => {
            resolve(text);
          });
        });
      });

    if (files.length > 0) {
      files.forEach((file) => {
        this._sharedInstancesBag.api.addFileFromObject(file, { source: 'clipboard' });
      });
      this.openUploadList();
    }

    if (urls.length > 0) {
      const resolvedUrls: string[] = await Promise.all(urls);
      resolvedUrls.forEach((url) => {
        this._sharedInstancesBag.api.addFileFromUrl(url, { source: 'clipboard' });
      });
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
