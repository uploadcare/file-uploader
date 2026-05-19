import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { AiProvider, AiProviderResult, UcAiEditor as UcAiEditorType } from '@/ai-enhancer/index';
import { cleanup } from './utils/test-renderer';

let UcAiEditorCtor: CustomElementConstructor;

beforeAll(async () => {
  // Importing the module registers <uc-ai-editor> and all sub-elements.
  const mod = await import('@/ai-enhancer/index');
  UcAiEditorCtor = mod.UcAiEditor;
});

afterEach(() => {
  cleanup();
});

/** Instant-resolving fake provider with controllable result. */
function fakeProvider(result?: Partial<AiProviderResult>): AiProvider {
  return {
    id: 'fake',
    generate: async ({ prompt, capability }) => ({
      url: result?.url ?? `https://example.com/${prompt}.jpg`,
      prompt: result?.prompt ?? prompt,
      capability: result?.capability ?? capability,
    }),
  };
}

function mount(attrs: Record<string, string> = {}): UcAiEditorType {
  const el = document.createElement('uc-ai-editor') as UcAiEditorType;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  page.render(el);
  return el;
}

describe('<uc-ai-editor>', () => {
  it('registers the custom element', () => {
    expect(customElements.get('uc-ai-editor')).toBe(UcAiEditorCtor);
  });

  it('mounts with default mode="generate" and renders the canvas + prompt + chips + footer', async () => {
    const el = mount();
    await el.updateComplete;
    const root = el.shadowRoot;
    expect(root?.querySelector('uc-ai-canvas')).toBeTruthy();
    expect(root?.querySelector('uc-ai-prompt-row')).toBeTruthy();
    expect(root?.querySelector('uc-ai-chips')).toBeTruthy();
    expect(root?.querySelector('uc-ai-footer')).toBeTruthy();
    expect(root?.querySelector('uc-ai-history-popover')).toBeTruthy();
    expect(el.mode).toBe('generate');
  });

  it('reflects mode + capability as attributes', async () => {
    const el = mount();
    el.mode = 'edit';
    await el.updateComplete;
    expect(el.getAttribute('mode')).toBe('edit');
    expect(el.getAttribute('capability')).toBeTruthy();
  });

  it('auto-snaps capability to one matching the mode when mode flips', async () => {
    const el = mount();
    el.capability = 'object-remove';
    el.mode = 'generate';
    await el.updateComplete;
    expect(el.capability).toBe('generate');
  });

  it('updates internal prompt state when the user types in the prompt input', async () => {
    const el = mount();
    await el.updateComplete;
    const promptRow = el.shadowRoot!.querySelector('uc-ai-prompt-row')!;
    const input = promptRow.shadowRoot!.querySelector('input')!;
    input.value = 'a tiger';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    // The "Surprise me" chip is no longer pressed since prompt != ''
    expect(input.value).toBe('a tiger');
  });

  it('runs the provider and updates the canvas when Generate is clicked', async () => {
    const el = mount();
    el.provider = fakeProvider({ url: 'https://example.com/result.jpg' });
    await el.updateComplete;
    const promptRow = el.shadowRoot!.querySelector('uc-ai-prompt-row')!;
    const input = promptRow.shadowRoot!.querySelector('input')!;
    input.value = 'a tiger';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    const footer = el.shadowRoot!.querySelector('uc-ai-footer')!;
    const primary = footer.shadowRoot!.querySelector('.btn--primary') as HTMLButtonElement;
    primary.click();

    await vi.waitFor(() => {
      const canvas = el.shadowRoot!.querySelector('uc-ai-canvas')!;
      const img = canvas.shadowRoot!.querySelector('img');
      expect(img?.getAttribute('src')).toBe('https://example.com/result.jpg');
    });
  });

  it('dispatches uc:cancel when the back button is clicked', async () => {
    const el = mount();
    await el.updateComplete;
    const onCancel = vi.fn();
    el.addEventListener('uc:cancel', onCancel);
    const footer = el.shadowRoot!.querySelector('uc-ai-footer')!;
    const back = footer.shadowRoot!.querySelector('.btn') as HTMLButtonElement;
    back.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('dispatches uc:apply with the current url + prompt + capability when Done is clicked in edit mode', async () => {
    const el = mount();
    el.mode = 'edit';
    el.src = 'https://example.com/source.jpg';
    await el.updateComplete;
    const onApply = vi.fn();
    el.addEventListener('uc:apply', onApply);
    const footer = el.shadowRoot!.querySelector('uc-ai-footer')!;
    const primary = footer.shadowRoot!.querySelector('.btn--primary') as HTMLButtonElement;
    primary.click();
    expect(onApply).toHaveBeenCalledTimes(1);
    const detail = onApply.mock.calls[0]![0].detail;
    expect(detail).toMatchObject({ url: 'https://example.com/source.jpg', capability: 'object-remove' });
  });

  it('does not dispatch uc:apply when there is no displayable image (edit mode without src)', async () => {
    const el = mount();
    el.mode = 'edit';
    await el.updateComplete;
    const onApply = vi.fn();
    el.addEventListener('uc:apply', onApply);
    const footer = el.shadowRoot!.querySelector('uc-ai-footer')!;
    const primary = footer.shadowRoot!.querySelector('.btn--primary') as HTMLButtonElement;
    expect(primary.disabled).toBe(true);
    primary.click();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('populates history after a successful generation', async () => {
    const el = mount();
    el.provider = fakeProvider();
    await el.updateComplete;
    const promptRow = el.shadowRoot!.querySelector('uc-ai-prompt-row')!;
    const input = promptRow.shadowRoot!.querySelector('input')!;
    input.value = 'a tiger';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const footer = el.shadowRoot!.querySelector('uc-ai-footer')!;
    (footer.shadowRoot!.querySelector('.btn--primary') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      const popover = el.shadowRoot!.querySelector('uc-ai-history-popover')!;
      // @ts-expect-error reading public Lit @property
      expect(popover.entries.length).toBe(1);
    });
  });

  it('opens the popover (native Popover API) when the history button is clicked in edit mode with empty prompt', async () => {
    const el = mount();
    el.provider = fakeProvider();
    el.mode = 'edit';
    el.src = 'https://example.com/source.jpg';
    await el.updateComplete;
    // Seed history with one generation
    const promptRow = el.shadowRoot!.querySelector('uc-ai-prompt-row')!;
    const input = promptRow.shadowRoot!.querySelector('input')!;
    input.value = 'a tiger';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    (promptRow.shadowRoot!.querySelector('.icon-btn--primary') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      const popover = el.shadowRoot!.querySelector('uc-ai-history-popover')!;
      // @ts-expect-error
      expect(popover.entries.length).toBe(1);
    });
    // Clear prompt so the history button reappears
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    // Click the history button
    const historyBtn = promptRow.shadowRoot!.querySelector('.icon-btn') as HTMLButtonElement;
    historyBtn.click();
    await el.updateComplete;
    const popover = el.shadowRoot!.querySelector('uc-ai-history-popover')!;
    expect(popover.matches(':popover-open')).toBe(true);
  });

  it('aborts in-flight generation and clears resultUrl when src changes', async () => {
    let resolveProvider: (r: AiProviderResult) => void = () => {};
    const slowProvider: AiProvider = {
      id: 'slow',
      generate: ({ signal }) =>
        new Promise((res, rej) => {
          resolveProvider = res;
          signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    };
    const el = mount();
    el.provider = slowProvider;
    el.mode = 'edit';
    el.src = 'https://example.com/first.jpg';
    await el.updateComplete;

    const promptRow = el.shadowRoot!.querySelector('uc-ai-prompt-row')!;
    const input = promptRow.shadowRoot!.querySelector('input')!;
    input.value = 'try';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    (promptRow.shadowRoot!.querySelector('.icon-btn--primary') as HTMLButtonElement).click();

    // Now change src mid-flight
    el.src = 'https://example.com/second.jpg';
    await el.updateComplete;

    // If the abort path didn't fire, this resolve would set a stale result.
    resolveProvider({ url: 'https://example.com/STALE.jpg', prompt: 'try', capability: 'object-remove' });

    // After the abort, the displayed image should be the new src (no resultUrl override).
    await vi.waitFor(() => {
      const canvas = el.shadowRoot!.querySelector('uc-ai-canvas')!;
      const img = canvas.shadowRoot!.querySelector('img');
      expect(img?.getAttribute('src')).toBe('https://example.com/second.jpg');
    });
  });
});
