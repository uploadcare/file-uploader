import type { LitElement, ReactiveController, ReactiveControllerHost } from 'lit';
import { sharedConfigKey } from '../abstract/sharedConfigKey';
import type { LitBlock } from './LitBlock';

type TestModeHost = ReactiveControllerHost & LitElement & LitBlock;

const isCustomElement = (el: Element): boolean => {
  return el.tagName?.includes('-') ?? false;
};

export class TestModeController implements ReactiveController {
  private trackedElements: Set<Element> = new Set();
  private originalValues: Map<Element, string> = new Map();
  private enabled = false;
  private unsubscribe?: () => void;

  constructor(private host: TestModeHost) {
    this.host.addController(this);
  }

  hostDisconnected(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.trackedElements.clear();
    this.originalValues.clear();
  }

  hostUpdated(): void {
    if (!this.unsubscribe && this.host.has(sharedConfigKey('testMode'))) {
      const unsubscribe = this.host.subConfigValue('testMode', (isEnabled: boolean) => {
        this.enabled = Boolean(isEnabled);
        this.applyTestMode();
      });
      this.unsubscribe = unsubscribe as (() => void) | undefined;
    }

    this.collectElements();
    this.applyTestMode();
  }

  private collectElements(): void {
    const litHost = this.host as unknown as LitElement;
    const root = (litHost.renderRoot ?? litHost) as Element | DocumentFragment;
    if (!root) {
      return;
    }

    const hostElement = this.host as unknown as Element;
    const hostTag = hostElement.tagName?.toLowerCase();
    const candidates = Array.from(root.querySelectorAll('[data-testid]')).filter(
      (el) => !isCustomElement(el),
    ) as Element[];

    for (const el of candidates) {
      if (hostTag && el.closest(hostTag) !== hostElement) {
        continue;
      }

      if (!this.trackedElements.has(el)) {
        const attrValue = el.getAttribute('data-testid');
        if (!attrValue) {
          continue;
        }
        this.trackedElements.add(el);
        this.originalValues.set(el, attrValue);
      }
    }

    for (const el of Array.from(this.trackedElements)) {
      if (!el.isConnected || (hostTag && el.closest(hostTag) !== hostElement)) {
        this.trackedElements.delete(el);
        this.originalValues.delete(el);
      }
    }
  }

  private applyTestMode(): void {
    if (!this.trackedElements.size) {
      return;
    }

    const prefix = this.host.testId || '';
    for (const el of this.trackedElements) {
      const baseValue = this.originalValues.get(el);
      if (!baseValue) {
        continue;
      }

      if (this.enabled) {
        el.setAttribute('data-testid', `${prefix}--${baseValue}`);
      } else {
        el.removeAttribute('data-testid');
      }
    }
  }
}
