import { describe, expect, it, vi } from 'vitest';
import { renderInlineStartFrom, renderMinimalTrigger, renderModalSourcePicker } from './layout-fragments';

type LitTemplate = { strings: TemplateStringsArray; values: unknown[] };

const staticText = (result: LitTemplate): string => result.strings.join('');

describe('layout-fragments', () => {
  it('renderModalSourcePicker builds a modal start-from tree', () => {
    const onCancel = vi.fn();
    const result = renderModalSourcePicker({ onCancel, cancelLabel: 'Cancel' }) as LitTemplate;
    const text = staticText(result);
    expect(text).toContain('uc-modal');
    expect(text).toContain('uc-start-from');
    expect(text).toContain('uc-drop-area');
    expect(text).toContain('uc-source-list');
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

  it('renderMinimalTrigger includes label and single flag', () => {
    const result = renderMinimalTrigger({ single: true, label: 'Choose file' }) as LitTemplate;
    const text = staticText(result);
    expect(text).toContain('uc-start-from');
    expect(text).toContain('uc-drop-area');
    expect(text).toContain('uc-copyright');
    expect(result.values).toContain('Choose file');
    expect(result.values).toContain(true);
  });

  it('renderInlineStartFrom wires cancel visibility and label', () => {
    const onCancel = vi.fn();
    const result = renderInlineStartFrom({
      onCancel,
      cancelLabel: 'Back',
      cancelHidden: true,
    }) as LitTemplate;
    expect(staticText(result)).toContain('uc-cancel-btn');
    expect(result.values).toContain(onCancel);
    expect(result.values).toContain('Back');
    expect(result.values).toContain(true);
  });
});
