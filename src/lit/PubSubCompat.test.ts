import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { initialConfig } from '../blocks/Config/initialConfig';
import { PubSub } from './PubSubCompat';

// Each test uses a unique ctx id and tears it down so the module-level
// context/controller maps and the global UploaderRegistry don't leak.
let seq = 0;
const ids: string[] = [];
const freshCtx = () => {
  const id = `pubsub-test-${seq++}`;
  ids.push(id);
  return PubSub.registerCtx<Record<string, unknown>>({ plain: 'seed' }, id);
};

afterEach(() => {
  for (const id of ids.splice(0)) PubSub.deleteCtx(id);
});

describe('PubSub config (*cfg/*) facade', () => {
  it('reads built-in config defaults from the controller without touching the nanostores store', () => {
    const ctx = freshCtx();
    expect(ctx.read('*cfg/multiple')).toBe(initialConfig.multiple);
    // Routed away from nanostores — the key never lands in the raw store.
    expect('*cfg/multiple' in ctx.store).toBe(false);
  });

  it('round-trips a config write through the controller', () => {
    const ctx = freshCtx();
    ctx.pub('*cfg/multiple', false);
    expect(ctx.read('*cfg/multiple')).toBe(false);
  });

  it('sub fires immediately when init=true and on subsequent changes to that key', () => {
    const ctx = freshCtx();
    const cb = vi.fn();
    ctx.sub('*cfg/multiple', cb, true);
    expect(cb).toHaveBeenLastCalledWith(initialConfig.multiple);

    ctx.pub('*cfg/multiple', false);
    expect(cb).toHaveBeenLastCalledWith(false);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('sub with init=false does not fire immediately', () => {
    const ctx = freshCtx();
    const cb = vi.fn();
    ctx.sub('*cfg/multiple', cb, false);
    expect(cb).not.toHaveBeenCalled();

    ctx.pub('*cfg/multiple', false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('a config sub does NOT fire when a different config key changes', () => {
    const ctx = freshCtx();
    const cb = vi.fn();
    ctx.sub('*cfg/multiple', cb, false);

    ctx.pub('*cfg/thumbSize', 120);
    expect(cb).not.toHaveBeenCalled();
  });

  it('has() is true for built-ins, false for unknown custom keys until added', () => {
    const ctx = freshCtx();
    expect(ctx.has('*cfg/multiple')).toBe(true);
    expect(ctx.has('*cfg/myPluginKey')).toBe(false);

    ctx.add('*cfg/myPluginKey', 'def');
    expect(ctx.has('*cfg/myPluginKey')).toBe(true);
    expect(ctx.read('*cfg/myPluginKey')).toBe('def');
  });

  it('add() is first-write-wins for known keys and overwrites only on rewrite', () => {
    const ctx = freshCtx();
    ctx.pub('*cfg/multiple', false);

    ctx.add('*cfg/multiple', true); // no rewrite — keeps current
    expect(ctx.read('*cfg/multiple')).toBe(false);

    ctx.add('*cfg/multiple', true, true); // rewrite
    expect(ctx.read('*cfg/multiple')).toBe(true);
  });

  it('registers the controller in UploaderRegistry on first config access and shares it across wrappers', () => {
    const ctx = freshCtx();
    const id = ctx.id;
    ctx.read('*cfg/multiple'); // triggers lazy controller creation

    const controller = UploaderRegistry.get(id);
    expect(controller).toBeDefined();

    // A second wrapper for the same ctx sees the same config state.
    const ctx2 = PubSub.getCtx<Record<string, unknown>>(id)!;
    ctx2.pub('*cfg/multiple', false);
    expect(controller?.config.get('multiple')).toBe(false);
    expect(ctx.read('*cfg/multiple')).toBe(false);
  });

  it('deleteCtx destroys and unregisters the controller', () => {
    const id = freshCtx().id;
    PubSub.getCtx<Record<string, unknown>>(id)!.read('*cfg/multiple');
    expect(UploaderRegistry.get(id)).toBeDefined();

    PubSub.deleteCtx(id);
    expect(UploaderRegistry.get(id)).toBeUndefined();
  });

  it('non-config keys still use the nanostores store', () => {
    const ctx = freshCtx();
    expect(ctx.read('plain')).toBe('seed');

    const cb = vi.fn();
    ctx.sub('plain', cb, false);
    ctx.pub('plain', 'changed');

    expect(ctx.read('plain')).toBe('changed');
    expect(cb).toHaveBeenCalledWith('changed');
  });
});
