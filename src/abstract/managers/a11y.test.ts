import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LitBlock } from '../../lit/LitBlock';
import { A11y } from './a11y';

// `A11y.registerBlock` only reaches into its argument as a `Node` (see
// `ScopedMinimalWindow.registerScope`); a bare DOM element stands in for a
// `LitBlock` here so these specs don't need a full Lit fixture.
const asLitBlock = (node: Node): LitBlock => node as unknown as LitBlock;

/**
 * Coverage gap-fill ahead of M9l's lazy-arm split (A11y currently attaches its
 * `keyux`-driven window listeners at construction, before any block registers
 * a scope). These pin CURRENT behavior:
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

    a11y.registerBlock(asLitBlock(scope));
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(button.classList.contains('is-pressed')).toBe(true);
  });

  it('keydown events targeting an element outside every registered scope stay inert', () => {
    const a11y = track(new A11y());
    const scope = document.createElement('div');
    document.body.append(scope);
    a11y.registerBlock(asLitBlock(scope));

    // Button lives outside the registered scope.
    const outsideButton = pressableButton();
    outsideButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(outsideButton.classList.contains('is-pressed')).toBe(false);
  });

  it('a keydown event whose target is not a DOM node (dispatched directly on window) stays inert regardless of scope', () => {
    const a11y = track(new A11y());
    const scope = document.createElement('div');
    document.body.append(scope);
    a11y.registerBlock(asLitBlock(scope));

    // Dispatched directly on `window`, `event.target` is the `Window` object
    // itself — not a `Node` — so `ScopedMinimalWindow`'s wrapped listener must
    // bail before ever consulting the scope list.
    expect(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))).not.toThrow();
  });

  it('destroy() returns the real window listener count to baseline across a full construct → registerBlock → destroy() cycle', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    // Pins pairing, not timing: whether the keyux window listeners attach at
    // construction (today) or are deferred to first `registerBlock` (M9l's
    // lazy-arm split), the net effect of a full lifecycle — including a real
    // scope registration — must be that every `window.addEventListener` this
    // instance made (click, focusin, focusout, keydown, keyup, keyuxJump — one
    // per keyux feature) is undone by a matching `removeEventListener` of the
    // same type by the time `destroy()` returns. No unregister path exists for
    // a registered block, so `registerBlock` then `destroy()` is the full cycle.
    const a11y = new A11y();
    const scope = document.createElement('div');
    document.body.append(scope);
    a11y.registerBlock(asLitBlock(scope));

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
    a11y.registerBlock(asLitBlock(scope));

    a11y.destroy();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(button.classList.contains('is-pressed')).toBe(false);
  });
});
