import { describe, expect, it, vi } from 'vitest';
import { UploaderRegistry } from '@/abstract/UploaderRegistry';
import { Uploader } from '@/index';
import { delay } from '@/utils/delay';
import { getCtxName } from '~/tests/utils/test-renderer';

describe('uc-uploader', () => {
  it('keeps a ctxName property set before the element upgrades', async () => {
    // A framework that sets properties on a not-yet-defined element (Vue's `in` check, Angular property binding).
    const tag = 'uc-uploader-pre-upgrade';
    const ctxName = getCtxName();
    const ensure = vi.spyOn(UploaderRegistry, 'ensure');
    const el = document.createElement(tag) as Uploader;
    el.ctxName = ctxName;
    document.body.append(el);
    customElements.define(tag, class extends Uploader {});
    await el.updateComplete;
    await delay(0);

    expect(el.ctxName).toBe(ctxName);
    expect([null, ctxName]).toContain(el.getAttribute('ctx-name'));
    expect(UploaderRegistry.get(ctxName)).toBeDefined();
    const others = [...new Set(ensure.mock.calls.map(([name]) => name))].filter((name) => name !== ctxName);
    expect(others.filter((name) => UploaderRegistry.get(name))).toEqual([]);
    ensure.mockRestore();
    el.remove();
  });
});
