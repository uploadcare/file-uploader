import { applyFocusVisiblePolyfill } from './applyFocusVisiblePolyfill.js';

type FocusVisibleDestructor = () => void;

const destructors = new WeakMap<Document | ShadowRoot, FocusVisibleDestructor>();

function handleFocusVisible(focusVisible: boolean, element: EventTarget): void {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  if (focusVisible) {
    const customOutline = element.style.getPropertyValue('--focus-visible-outline');
    element.style.outline = customOutline || '2px solid var(--color-focus-ring)';
  } else {
    element.style.outline = 'none';
  }
}

export const FocusVisible = {
  handleFocusVisible,
  register(scope: ShadowRoot | Document): void {
    destructors.set(scope, applyFocusVisiblePolyfill(scope, handleFocusVisible));
  },
  unregister(scope: Document | ShadowRoot): void {
    const removeFocusVisiblePolyfill = destructors.get(scope);
    if (!removeFocusVisiblePolyfill) {
      return;
    }
    removeFocusVisiblePolyfill();
    destructors.delete(scope);
  },
};
