import { afterEach, describe, expect, it, vi } from 'vitest';
import { A11y } from './a11y';

// `A11y.registerBlock` only reaches into its argument as a `Node` (see
// `ScopedMinimalWindow.registerScope`), so a bare DOM element stands in here
// (no full Lit fixture needed).
const asNode = (node: Node): Node => node;

/**
 * Coverage written ahead of M9l's lazy-arm split (v1 attached the
 * `keyux`-driven window listeners at construction; they now arm on the first
 * `registerBlock`). These pins are timing-agnostic and hold either way:
 *  - a constructed-but-unregistered instance is provably inert on real window
 *    events (the load-bearing fact for "arm-on-registration is
 *    behavior-identical to arm-at-construction");
 *  - registering a block's scope is what makes keyux features observable;
 *  - `destroy()` returns the real `window` listener count to baseline (no
 *    leaked `click`/`focusin`/`focusout`/`keyuxJump` listeners survive it).
 */
describe('A11y', () => {
  const instances: A11y[] = [];
  const track = (instance: A11y) => {
    instances.push(instance);
    return instance;
  };

  afterEach(() => {
    for (const instance of instances.splice(0)) {
      instance.destroy();
    }
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  const pressableButton = (): HTMLButtonElement => {
    const button = document.createElement('button');
    document.body.append(button);
    return button;
  };

  it('a constructed instance with no registered block is inert on real window keydown events', () => {
    track(new A11y());
    const button = pressableButton();

    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    // pressKeyUX would add this class on Enter/Space against a button/anchor
    // target — it never fires because `ScopedMinimalWindow`'s scope gate
    // (`this._scope.some(...)` over an empty array) is unconditionally false.
    expect(button.classList.contains('is-pressed')).toBe(false);
  });

  it('registering a block scope makes keyux features observable inside that scope', () => {
    const a11y = track(new A11y());
    const scope = document.createElement('div');
    document.body.append(scope);
    const button = document.createElement('button');
    scope.append(button);

    a11y.registerBlock(asNode(scope));
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(button.classList.contains('is-pressed')).toBe(true);
  });

  it('keydown events targeting an element outside every registered scope stay inert', () => {
    const a11y = track(new A11y());
    const scope = document.createElement('div');
    document.body.append(scope);
    a11y.registerBlock(asNode(scope));

    // Button lives outside the registered scope.
    const outsideButton = pressableButton();
    outsideButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(outsideButton.classList.contains('is-pressed')).toBe(false);
  });

  it('a keydown event whose target is not a DOM node (dispatched directly on window) stays inert regardless of scope', () => {
    const a11y = track(new A11y());
    const scope = document.createElement('div');
    document.body.append(scope);
    a11y.registerBlock(asNode(scope));

    // Dispatched directly on `window`, `event.target` is the `Window` object
    // itself — not a `Node` — so `ScopedMinimalWindow`'s wrapped listener must
    // bail before ever consulting the scope list.
    expect(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))).not.toThrow();
  });

  it('construction attaches no window listener (arming is deferred to first registerBlock)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    track(new A11y());

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('arms exactly once across multiple registerBlock calls (idempotent)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const a11y = track(new A11y());

    a11y.registerBlock(asNode(document.createElement('div')));
    const firstCallCount = addSpy.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    a11y.registerBlock(asNode(document.createElement('div')));
    a11y.registerBlock(asNode(document.createElement('div')));

    expect(addSpy.mock.calls.length).toBe(firstCallCount);
  });

  it('destroy() disarms unconditionally, and registerBlock after destroy() does not re-arm', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const a11y = new A11y();

    a11y.registerBlock(asNode(document.createElement('div')));
    a11y.destroy();
    addSpy.mockClear();

    const scope = document.createElement('div');
    document.body.append(scope);
    const button = document.createElement('button');
    scope.append(button);
    a11y.registerBlock(asNode(scope));

    expect(addSpy).not.toHaveBeenCalled();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(button.classList.contains('is-pressed')).toBe(false);
  });

  it('destroy() returns the real window listener count to baseline across a full construct → registerBlock → destroy() cycle', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    // Pins pairing, not timing: whether the keyux window listeners attach at
    // construction (v1) or on first `registerBlock` (M9l's lazy-arm split,
    // current), the net effect of a full lifecycle — including a real
    // scope registration — must be that every `window.addEventListener` this
    // instance made (click, focusin, focusout, keydown, keyup, keyuxJump — one
    // per keyux feature) is undone by a matching `removeEventListener` of the
    // same type by the time `destroy()` returns. No unregister path exists for
    // a registered block, so `registerBlock` then `destroy()` is the full cycle.
    const a11y = new A11y();
    const scope = document.createElement('div');
    document.body.append(scope);
    a11y.registerBlock(asNode(scope));

    const addedTypes = addSpy.mock.calls.map((call) => call[0]).sort();
    expect(addedTypes.length).toBeGreaterThan(0);

    a11y.destroy();
    const removedTypes = removeSpy.mock.calls.map((call) => call[0]).sort();

    expect(removedTypes).toEqual(addedTypes);
  });

  it('destroy() leaves subsequent window keydown events inert even against a previously registered scope', () => {
    const a11y = new A11y();
    const scope = document.createElement('div');
    document.body.append(scope);
    const button = document.createElement('button');
    scope.append(button);
    a11y.registerBlock(asNode(scope));

    a11y.destroy();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(button.classList.contains('is-pressed')).toBe(false);
  });

  const buttonInScope = (): { scope: HTMLDivElement; button: HTMLButtonElement } => {
    const scope = document.createElement('div');
    document.body.append(scope);
    const button = document.createElement('button');
    scope.append(button);
    return { scope, button };
  };

  it('unregisterBlock detaches a scope: keydown targeting it goes inert', () => {
    const a11y = track(new A11y());
    const { scope, button } = buttonInScope();
    a11y.registerBlock(asNode(scope));

    a11y.unregisterBlock(asNode(scope));
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(button.classList.contains('is-pressed')).toBe(false);
  });

  it('unregistering one of two scopes keeps the other armed and observable', () => {
    const a11y = track(new A11y());
    const a = buttonInScope();
    const b = buttonInScope();
    a11y.registerBlock(asNode(a.scope));
    a11y.registerBlock(asNode(b.scope));

    a11y.unregisterBlock(asNode(a.scope));

    a.button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    b.button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(a.button.classList.contains('is-pressed')).toBe(false);
    expect(b.button.classList.contains('is-pressed')).toBe(true);
  });

  it('unregistering the last scope disarms the window listeners (paired remove for every add)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const a11y = track(new A11y());
    const { scope } = buttonInScope();

    a11y.registerBlock(asNode(scope));
    const addedTypes = addSpy.mock.calls.map((call) => call[0]).sort();
    expect(addedTypes.length).toBeGreaterThan(0);

    a11y.unregisterBlock(asNode(scope));
    const removedTypes = removeSpy.mock.calls.map((call) => call[0]).sort();
    expect(removedTypes).toEqual(addedTypes);
  });

  it('re-arms when a scope is registered again after the last one was unregistered', () => {
    const a11y = track(new A11y());
    const { scope, button } = buttonInScope();

    a11y.registerBlock(asNode(scope));
    a11y.unregisterBlock(asNode(scope)); // last scope → disarm
    a11y.registerBlock(asNode(scope)); // re-arm

    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(button.classList.contains('is-pressed')).toBe(true);
  });

  it('unregisterBlock after destroy() is a no-op (does not throw)', () => {
    const a11y = new A11y();
    const { scope } = buttonInScope();
    a11y.registerBlock(asNode(scope));
    a11y.destroy();

    expect(() => a11y.unregisterBlock(asNode(scope))).not.toThrow();
  });
});
