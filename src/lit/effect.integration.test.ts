import { SignalWatcher, signal } from '@lit-labs/signals';
import { html, LitElement } from 'lit';
import { describe, expect, it } from 'vitest';
import { delay } from '../utils/delay';
import { type EffectHost, effect, registerHostEffects } from './effect';

// Integration coverage for the `@effect` timing guarantees the milestone relies
// on, exercised against a REAL `SignalWatcher` element (not the unit-test fake):
//   1. `{ beforeUpdate: true }` runs synchronously on registration (eager).
//   2. it re-fires on a signal change EVEN WHEN `shouldUpdate()` is false — the
//      FileItem `_pauseRender` lazy-render gate — so a host-attribute effect
//      still tracks config while the element is scrolled out of view.
//   3. the default (after-update) effect first runs after `updateComplete`.

let seq = 0;
const define = (cls: CustomElementConstructor): string => {
  const tag = `uc-effect-it-${seq++}`;
  customElements.define(tag, cls);
  return tag;
};

describe('@effect integration (real SignalWatcher element)', () => {
  it('beforeUpdate: fires eagerly on registration, and on change even while render is gated', async () => {
    const mode = signal('list');

    class El extends SignalWatcher(LitElement) {
      public paused = true;
      public readonly seen: string[] = [];

      @effect({ beforeUpdate: true })
      protected _applyMode(): void {
        const value = mode.get();
        this.seen.push(value);
        this.setAttribute('mode', value);
      }

      protected override shouldUpdate(): boolean {
        return !this.paused; // mimic FileItem `_pauseRender`
      }

      public override render() {
        return html``;
      }
    }
    const tag = define(El);
    const el = document.createElement(tag) as El;
    document.body.append(el);

    // Eager, synchronous first run at registration.
    registerHostEffects(el as unknown as EffectHost);
    expect(el.seen).toEqual(['list']);
    expect(el.getAttribute('mode')).toBe('list');

    // Change the signal while render stays gated (paused). The before-update
    // effect must still flush.
    mode.set('grid');
    await delay(0);
    expect(el.seen).toEqual(['list', 'grid']);
    expect(el.getAttribute('mode')).toBe('grid');

    el.remove();
  });

  it('default (after-update) effect first runs after updateComplete, then on change', async () => {
    const value = signal('a');

    class El extends SignalWatcher(LitElement) {
      public readonly seen: string[] = [];

      @effect()
      protected _watch(): void {
        this.seen.push(value.get());
      }

      public override render() {
        return html``;
      }
    }
    const tag = define(El);
    const el = document.createElement(tag) as El & { updateComplete: Promise<unknown> };
    document.body.append(el);

    registerHostEffects(el as unknown as EffectHost);
    // Not yet — deferred to after the first update.
    expect(el.seen).toEqual([]);
    await el.updateComplete;
    await delay(0);
    expect(el.seen).toEqual(['a']);

    value.set('b');
    await delay(0);
    expect(el.seen).toEqual(['a', 'b']);

    el.remove();
  });
});
