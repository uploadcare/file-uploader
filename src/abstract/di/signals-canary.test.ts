import { Computed, computed, Signal, SignalWatcher, State, signal } from '@lit-labs/signals';
import { LitElement } from 'lit';
import { describe, expect, it } from 'vitest';

/**
 * Canary asserting the `@lit-labs/signals` public surface the DI layer depends
 * on. If a version bump renames or restructures these exports, this fails loudly
 * rather than the DI decorators breaking cryptically.
 */
describe('@lit-labs/signals surface', () => {
  it('exposes the signal factories', () => {
    expect(typeof signal).toBe('function');
    expect(typeof computed).toBe('function');
    expect(signal(1)).toBeInstanceOf(Signal.State);
    expect(computed(() => 1)).toBeInstanceOf(Signal.Computed);
  });

  it('exposes the Signal namespace classes and their aliases', () => {
    expect(typeof Signal.State).toBe('function');
    expect(typeof Signal.Computed).toBe('function');
    expect(State).toBe(Signal.State);
    expect(Computed).toBe(Signal.Computed);
  });

  it('exposes SignalWatcher as a plain mixin (not an ECMA decorator)', () => {
    expect(typeof SignalWatcher).toBe('function');
    // A mixin takes a base class and returns a subclass of it. An ECMA/standard
    // decorator would instead take (value, context) and not produce a subclass.
    const Mixed = SignalWatcher(LitElement);
    expect(typeof Mixed).toBe('function');
    expect(Object.getPrototypeOf(Mixed)).toBe(LitElement);
    expect(Mixed).not.toBe(LitElement);
  });
});
