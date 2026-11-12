import type { LitElement } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../lit/ensureUploaderCtx';
import { EditorScroller } from './CloudImageEditor/src/EditorScroller';
import { DropArea } from './DropArea/DropArea';

// Idempotent (same path as defineComponents(UC)).
DropArea.reg('uc-drop-area');
EditorScroller.reg('uc-editor-scroller');

// Flags CSS reads off the host attribute. React 19 sets a property whenever the element has one, so
// `<uc-drop-area ghost>` from JSX assigns `el.ghost = true`: the property must reach the attribute.
const FLAGS = [
  ['uc-drop-area', 'single', 'single'],
  ['uc-drop-area', 'ghost', 'ghost'],
  ['uc-editor-scroller', 'hidden-scrollbar', 'hiddenScrollbar'],
] as const;

const CTX = 'boolean-flag-properties-spec';
const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  UploaderRegistry.dispose(CTX);
});

const mount = async (tag: string): Promise<LitElement> => {
  ensureUploaderCtx(CTX);
  const el = document.createElement(tag) as LitElement;
  el.setAttribute('ctx-name', CTX);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

describe('block flag properties set the attribute CSS reads', () => {
  it.each(FLAGS)('<%s> .%s', async (tag, attr, prop) => {
    const el = await mount(tag);
    expect(el.hasAttribute(attr)).toBe(false);

    Reflect.set(el, prop, true);
    await el.updateComplete;
    expect(el.hasAttribute(attr)).toBe(true);

    Reflect.set(el, prop, false);
    await el.updateComplete;
    expect(el.hasAttribute(attr)).toBe(false);
  });

  it.each(FLAGS)('<%s %s="false"> stays on after connecting', async (tag, attr, prop) => {
    const el = document.createElement(tag) as LitElement;
    el.setAttribute(attr, 'false');
    el.setAttribute('ctx-name', CTX);
    ensureUploaderCtx(CTX);
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;
    expect(Reflect.get(el, prop)).toBe(true);
    expect(el.hasAttribute(attr)).toBe(true);

    el.removeAttribute(attr);
    await el.updateComplete;
    expect(Reflect.get(el, prop)).toBe(false);
    expect(el.hasAttribute(attr)).toBe(false);
  });
});
