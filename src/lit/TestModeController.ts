import type { LitElement, ReactiveController, ReactiveControllerHost } from 'lit';
import { sharedConfigKey } from '../abstract/sharedConfigKey';
import type { LitBlock } from './LitBlock';

type TestModeHost = ReactiveControllerHost & LitElement & LitBlock;

const isCustomElement = (el: Element): boolean => {
  return el.tagName?.includes('-') ?? false;
};

/**
 * The block an element belongs to: the closest custom-element ancestor.
 *
 * Every block whose subtree contains the element used to claim it, and each prefixed the id in turn, so a `dialog`
 * inside `<uc-modal>` inside a solution came out as `uc-file-uploader-regular--uc-modal--dialog`. Claiming only from
 * the nearest block keeps ids stable and independent of how deeply the element happens to be nested.
 */
const owningBlock = (el: Element): Element | null => {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    if (isCustomElement(parent)) {
      return parent;
    }
  }
  return null;
};

export class TestModeController implements ReactiveController {
  private _trackedElements: Set<Element> = new Set();
  private _originalValues: Map<Element, string> = new Map();
  private _enabled = false;
  private _unsubscribe?: () => void;
  private _host: TestModeHost;

  public constructor(host: TestModeHost) {
    this._host = host;
    this._host.addController(this);
  }

  public hostDisconnected(): void {
    this._unsubscribe?.();
    this._unsubscribe = undefined;
    this._trackedElements.clear();
    this._originalValues.clear();
  }

  public hostUpdated(): void {
    if (!this._unsubscribe && this._host.has(sharedConfigKey('testMode'))) {
      const unsubscribe = this._host.subConfigValue('testMode', (isEnabled: boolean) => {
        this._enabled = Boolean(isEnabled);
        this._applyTestMode();
      });
      this._unsubscribe = unsubscribe as (() => void) | undefined;
    }

    this._collectElements();
    this._applyTestMode();
  }

  private _collectElements(): void {
    const litHost = this._host as unknown as LitElement;
    const root = (litHost.renderRoot ?? litHost) as Element | DocumentFragment;
    if (!root) {
      return;
    }

    const hostElement = this._host as unknown as Element;
    const candidates = Array.from(root.querySelectorAll('[data-testid]')).filter(
      (el) => !isCustomElement(el),
    ) as Element[];

    for (const el of candidates) {
      if (owningBlock(el) !== hostElement) {
        continue;
      }

      if (!this._trackedElements.has(el)) {
        const attrValue = el.getAttribute('data-testid');
        if (!attrValue) {
          continue;
        }
        this._trackedElements.add(el);
        this._originalValues.set(el, attrValue);
      }
    }

    for (const el of Array.from(this._trackedElements)) {
      if (!el.isConnected || owningBlock(el) !== hostElement) {
        this._trackedElements.delete(el);
        this._originalValues.delete(el);
      }
    }
  }

  private _applyTestMode(): void {
    if (!this._trackedElements.size) {
      return;
    }

    const prefix = this._host.testId || '';
    for (const el of this._trackedElements) {
      const baseValue = this._originalValues.get(el);
      if (!baseValue) {
        continue;
      }

      if (this._enabled) {
        el.setAttribute('data-testid', `${prefix}--${baseValue}`);
      } else {
        el.removeAttribute('data-testid');
      }
    }
  }
}
