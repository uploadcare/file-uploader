import { describe, expect, it, vi } from 'vitest';
import { renderInlineStartFrom, renderMinimalTrigger, renderModalSourcePicker } from './layout-fragments';

type LitTemplate = { strings: TemplateStringsArray; values: unknown[] };

const staticText = (result: LitTemplate): string => result.strings.join('');

describe('layout-fragments', () => {
  it('renderModalSourcePicker builds a modal start-from tree with fidelity-critical attrs', () => {
    const onCancel = vi.fn();
    const result = renderModalSourcePicker({ onCancel, cancelLabel: 'Cancel' }) as LitTemplate;
    const text = staticText(result);
    expect(text).toContain('uc-modal');
    expect(text).toContain('id="start-from"');
    expect(text).toContain('strokes');
    expect(text).toContain('block-body-scrolling');
    expect(text).toContain('uc-start-from');
    expect(text).toContain('uc-drop-area');
    expect(text).toContain('with-icon');
    expect(text).toContain('clickable');
    expect(text).toContain('uc-source-list');
    expect(text).toContain('role="list"');
    expect(text).toContain('uc-secondary-btn');
    // Modal cancel is secondary only — not the inline `.uc-cancel-btn` class.
    expect(text).not.toContain('uc-cancel-btn');
    expect(result.values).toContain(onCancel);
    expect(result.values).toContain('Cancel');
  });

  it('renderModalSourcePicker with copyright includes a nested template', () => {
    const withCopyright = renderModalSourcePicker({
      onCancel: vi.fn(),
      cancelLabel: 'Cancel',
      copyright: true,
    }) as LitTemplate;
    const without = renderModalSourcePicker({
      onCancel: vi.fn(),
      cancelLabel: 'Cancel',
    }) as LitTemplate;
    // copyright:true injects a TemplateResult; false/absent injects null.
    expect(withCopyright.values.some((v) => v !== null && typeof v === 'object')).toBe(true);
    expect(without.values).toContain(null);
  });

  it('renderMinimalTrigger pins initflow, clickable, tabindex, label, and single', () => {
    const result = renderMinimalTrigger({ single: true, label: 'Choose file' }) as LitTemplate;
    const text = staticText(result);
    expect(text).toContain('uc-start-from');
    expect(text).toContain('uc-drop-area');
    expect(text).toContain('initflow');
    expect(text).toContain('clickable');
    expect(text).toContain('tabindex="0"');
    expect(text).toContain('uc-copyright');
    expect(result.values).toContain('Choose file');
    expect(result.values).toContain(true); // single
  });

  it('renderInlineStartFrom pins cancel class, with-icon drop-area, and visibility', () => {
    const onCancel = vi.fn();
    const result = renderInlineStartFrom({
      onCancel,
      cancelLabel: 'Back',
      cancelHidden: true,
    }) as LitTemplate;
    const text = staticText(result);
    expect(text).toContain('uc-drop-area');
    expect(text).toContain('with-icon');
    expect(text).toContain('clickable');
    expect(text).toContain('uc-source-list');
    expect(text).toContain('uc-cancel-btn');
    expect(text).toContain('uc-secondary-btn');
    expect(text).toContain('uc-copyright');
    expect(result.values).toContain(onCancel);
    expect(result.values).toContain('Back');
    expect(result.values).toContain(true); // cancelHidden
  });
});
