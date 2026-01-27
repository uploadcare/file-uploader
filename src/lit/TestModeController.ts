import type { LitElement, ReactiveController, ReactiveControllerHost } from 'lit';
import { sharedConfigKey } from '../abstract/sharedConfigKey';
import type { LitBlock } from './LitBlock';

type TestModeHost = ReactiveControllerHost & LitElement & LitBlock;

const isCustomElement = (el: Element): boolean => {
  return el.tagName?.includes('-') ?? false;
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
    const hostTag = hostElement.tagName?.toLowerCase();
    const candidates = Array.from(root.querySelectorAll('[data-testid]')).filter(
      (el) => !isCustomElement(el),
    ) as Element[];

    for (const el of candidates) {
      if (hostTag && el.closest(hostTag) !== hostElement) {
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
      if (!el.isConnected || (hostTag && el.closest(hostTag) !== hostElement)) {
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
