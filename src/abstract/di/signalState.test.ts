import { computed, Signal } from '@lit-labs/signals';
import { describe, expect, it } from 'vitest';
import { signalState } from './signalState';

describe('@signalState', () => {
  it('seeds the signal from a field initializer', () => {
    class Model {
      @signalState() public value = 'init';
    }

    expect(new Model().value).toBe('init');
  });

  it('returns undefined for a field with no initializer', () => {
    class Model {
      @signalState() public value?: string;
    }

    expect(new Model().value).toBeUndefined();
  });

  it('round-trips reads and writes', () => {
    class Model {
      @signalState() public value = 1;
    }
    const model = new Model();

    model.value = 2;
    expect(model.value).toBe(2);
  });

  it('keeps per-instance state isolated', () => {
    class Model {
      @signalState() public value = 'a';
    }
    const first = new Model();
    const second = new Model();

    first.value = 'changed';

    expect(first.value).toBe('changed');
    expect(second.value).toBe('a');
  });

  it('dedups writes with Object.is', () => {
    class Model {
      @signalState() public value = 'x';
    }
    const model = new Model();
    let recomputes = 0;
    const derived = computed(() => {
      recomputes++;
      return model.value;
    });

    expect(derived.get()).toBe('x');
    expect(recomputes).toBe(1);

    // Writing the same value must not dirty the signal.
    model.value = 'x';
    expect(derived.get()).toBe('x');
    expect(recomputes).toBe(1);

    // A genuinely different value dirties it.
    model.value = 'y';
    expect(derived.get()).toBe('y');
    expect(recomputes).toBe(2);
  });

  it('is tracked under a Signal watcher', () => {
    class Model {
      @signalState() public value = 0;
    }
    const model = new Model();
    const derived = new Signal.Computed(() => model.value);
    let notified = 0;
    const watcher = new Signal.subtle.Watcher(() => {
      notified++;
    });
    watcher.watch(derived);
    // Establish the dependency by reading the computed once.
    derived.get();

    model.value = 42;

    expect(notified).toBe(1);
    expect(derived.get()).toBe(42);
  });
});
