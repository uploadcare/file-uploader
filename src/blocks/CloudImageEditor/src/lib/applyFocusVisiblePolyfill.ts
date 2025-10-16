/* 
 * Helper function for legacy browsers and iframes which sometimes focus on elements like document, body, and
 * non-interactive SVG.
 */
function isElement(target: EventTarget | null): target is Element {
  return target instanceof Element;
}

function isValidFocusTarget(target: EventTarget | null): target is Element {
  if (!target || target === document) {
    return false;
  }

  if (!isElement(target)) {
    return false;
  }

  if (target.nodeName === 'HTML' || target.nodeName === 'BODY') {
    return false;
  }

  return 'classList' in target && 'contains' in target.classList;
}

/* 
 * Computes whether the given element should automatically trigger the `focus-visible` class being added, i.e., whether
 * it should always match `:focus-visible` when focused.
 */
function focusTriggersKeyboardModality(target: EventTarget | null): boolean {
  if (!isElement(target)) {
    return false;
  }

  if (target instanceof HTMLInputElement && !target.readOnly) {
    return true;
  }

  if (target instanceof HTMLTextAreaElement && !target.readOnly) {
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return false;
}

let hadKeyboardEvent = true;
let hadFocusVisibleRecently = false;

/* 
 * Applies the :focus-visible polyfill at the given scope. A scope, in this case, is either the top-level Document or a
 * Shadow Root.
 */
export function applyFocusVisiblePolyfill(
  scope: Document | ShadowRoot,
  callback?: (focusVisible: boolean, target: EventTarget) => void,
): () => void {
  let hadFocusVisibleRecentlyTimeout: number | null = null;
  const onFocusVisibleChange = callback ?? (() => {});

  function addFocusVisibleClass(target: Element): void {
    target.setAttribute('focus-visible', '');
    onFocusVisibleChange(true, target);
  }

  function removeFocusVisibleClass(target: Element): void {
    if (!target.hasAttribute('focus-visible')) {
      return;
    }
    target.removeAttribute('focus-visible');
    onFocusVisibleChange(false, target);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.metaKey || event.altKey || event.ctrlKey) {
      return;
    }

    const activeElement = scope.activeElement;
    if (isValidFocusTarget(activeElement)) {
      addFocusVisibleClass(activeElement);
    }

    hadKeyboardEvent = true;
  }

  function onPointerDown(): void {
    hadKeyboardEvent = false;
  }

  function onFocus(event: Event): void {
    const target = event.target;
    if (!isValidFocusTarget(target)) {
      return;
    }

    if (hadKeyboardEvent || focusTriggersKeyboardModality(target)) {
      addFocusVisibleClass(target);
    }
  }

  function onBlur(event: Event): void {
    const target = event.target;
    if (!isValidFocusTarget(target)) {
      return;
    }

    if (target.hasAttribute('focus-visible')) {
      hadFocusVisibleRecently = true;
      if (hadFocusVisibleRecentlyTimeout) {
        window.clearTimeout(hadFocusVisibleRecentlyTimeout);
      }
      hadFocusVisibleRecentlyTimeout = window.setTimeout(() => {
        hadFocusVisibleRecently = false;
      }, 100);
      removeFocusVisibleClass(target);
    }
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      if (hadFocusVisibleRecently) {
        hadKeyboardEvent = true;
      }
      addInitialPointerMoveListeners();
    }
  }

  function onInitialPointerMove(event: Event): void {
    const target = event.target;
    if (isElement(target) && target.nodeName.toLowerCase() === 'html') {
      return;
    }

    hadKeyboardEvent = false;
    removeInitialPointerMoveListeners();
  }

  function addInitialPointerMoveListeners(): void {
    document.addEventListener('mousemove', onInitialPointerMove);
    document.addEventListener('mousedown', onInitialPointerMove);
    document.addEventListener('mouseup', onInitialPointerMove);
    document.addEventListener('pointermove', onInitialPointerMove);
    document.addEventListener('pointerdown', onInitialPointerMove);
    document.addEventListener('pointerup', onInitialPointerMove);
    document.addEventListener('touchmove', onInitialPointerMove);
    document.addEventListener('touchstart', onInitialPointerMove);
    document.addEventListener('touchend', onInitialPointerMove);
  }

  function removeInitialPointerMoveListeners(): void {
    document.removeEventListener('mousemove', onInitialPointerMove);
    document.removeEventListener('mousedown', onInitialPointerMove);
    document.removeEventListener('mouseup', onInitialPointerMove);
    document.removeEventListener('pointermove', onInitialPointerMove);
    document.removeEventListener('pointerdown', onInitialPointerMove);
    document.removeEventListener('pointerup', onInitialPointerMove);
    document.removeEventListener('touchmove', onInitialPointerMove);
    document.removeEventListener('touchstart', onInitialPointerMove);
    document.removeEventListener('touchend', onInitialPointerMove);
  }

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('mousedown', onPointerDown, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('touchstart', onPointerDown, true);
  document.addEventListener('visibilitychange', onVisibilityChange, true);

  addInitialPointerMoveListeners();

  scope.addEventListener('focus', onFocus, true);
  scope.addEventListener('blur', onBlur, true);

  return () => {
    removeInitialPointerMoveListeners();

    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('mousedown', onPointerDown, true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('touchstart', onPointerDown, true);
    document.removeEventListener('visibilitychange', onVisibilityChange, true);

    scope.removeEventListener('focus', onFocus, true);
    scope.removeEventListener('blur', onBlur, true);
  };
}
