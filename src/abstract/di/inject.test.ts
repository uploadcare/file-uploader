import { describe, expect, it } from 'vitest';
import { CONTAINER, ControllerContainer } from './ControllerContainer';
import { inject } from './inject';

describe('@inject', () => {
  it('resolves the dependency lazily on access, not at construction', () => {
    let depConstructed = 0;
    class Dep {
      public constructor() {
        depConstructed++;
      }
    }
    class Consumer {
      @inject(Dep) public dep!: Dep;
    }
    const container = new ControllerContainer();

    const consumer = container.get(Consumer);
    // Constructing the consumer must not touch the dependency.
    expect(depConstructed).toBe(0);

    const dep = consumer.dep;
    expect(dep).toBeInstanceOf(Dep);
    expect(depConstructed).toBe(1);
    // Resolves the container singleton, and re-access does not reconstruct.
    expect(consumer.dep).toBe(container.get(Dep));
    expect(depConstructed).toBe(1);
  });

  it('supports thunk tokens for forward/circular references', () => {
    class A {
      @inject(() => B) public b!: B;
    }
    class B {
      @inject(A) public a!: A;
    }
    const container = new ControllerContainer();

    const a = container.get(A);

    expect(a.b).toBeInstanceOf(B);
    expect(a.b.a).toBe(a);
    expect(a.b.a.b).toBe(a.b);
  });

  it('throws when the instance was not created by a container', () => {
    class Dep {}
    class Consumer {
      @inject(Dep) public dep!: Dep;
    }

    const orphan = new Consumer();

    expect(() => orphan.dep).toThrow(/@inject on 'dep': instance not created by a container/);
  });

  it('resolves once the container tag is set manually', () => {
    class Dep {}
    class Consumer {
      @inject(Dep) public dep!: Dep;
    }
    const container = new ControllerContainer();
    const consumer = new Consumer() as Consumer & { [CONTAINER]?: ControllerContainer };
    consumer[CONTAINER] = container;

    expect(consumer.dep).toBe(container.get(Dep));
  });
});
