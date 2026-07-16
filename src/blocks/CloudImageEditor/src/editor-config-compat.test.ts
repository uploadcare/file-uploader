import { afterEach, describe, expect, it, vi } from 'vitest';
import { sharedConfigKey } from '../../../abstract/sharedConfigKey';
import { PubSub } from '../../../lit/PubSubCompat';
import type { SharedState } from '../../../lit/SharedState';
import { subscribeUploaderConfigCompat } from './editor-config-compat';

const ctxNames = new Set<string>();

const createCtxName = (): string => {
  const ctxName = `editor-config-compat-${crypto.randomUUID()}`;
  ctxNames.add(ctxName);
  return ctxName;
};

describe('subscribeUploaderConfigCompat', () => {
  afterEach(() => {
    for (const ctxName of ctxNames) {
      PubSub.deleteCtx(ctxName);
    }
    ctxNames.clear();
  });

  it('is inert when no sibling ctx exists', () => {
    const onConfig = vi.fn();
    const onLocale = vi.fn();

    const unsubscribe = subscribeUploaderConfigCompat(createCtxName(), onConfig, onLocale);

    expect(onConfig).not.toHaveBeenCalled();
    expect(onLocale).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('reads editor config from a pre-seeded sibling ctx', () => {
    const ctxName = createCtxName();
    PubSub.registerCtx<SharedState>(
      { [sharedConfigKey('cdnCname')]: 'https://cdn.example.com/' } as SharedState,
      ctxName,
    );
    const onConfig = vi.fn();

    const unsubscribe = subscribeUploaderConfigCompat(ctxName, onConfig, vi.fn());

    expect(onConfig).toHaveBeenCalledWith({ cdnCname: 'https://cdn.example.com/' });
    unsubscribe();
  });
});
