import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { type AiCapability, type AiEditorMode, CAPABILITIES, CAPABILITIES_FOR_MODE } from './capabilities';
import { GenerationController } from './controllers/GenerationController';
import type { enLocale } from './locales/en';
import { translate } from './locales/translate';
import { mockBflProvider } from './providers/mockBfl';
import type { AiProvider } from './providers/types';
import styles from './ui/ai-editor.css?inline';
import './ui/parts/UcAiCanvas';
import './ui/parts/UcAiChips';
import './ui/parts/UcAiFooter';
import './ui/parts/UcAiHistoryPopover';
import './ui/parts/UcAiPromptRow';
import type { TemplateSelectDetail } from './ui/parts/UcAiChips';
import type { HistorySelectDetail } from './ui/parts/UcAiHistoryPopover';
import type { PromptInputDetail, UcAiPromptRow } from './ui/parts/UcAiPromptRow';

export type { HistoryEntry } from './controllers/GenerationController';

export type ApplyDetail = {
  url: string;
  prompt: string;
  capability: AiCapability;
};

export class UcAiEditor extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property({ reflect: true })
  public mode: AiEditorMode = 'generate';

  @property()
  public src: string | null = null;

  @property({ reflect: true })
  public capability: AiCapability = 'generate';

  @property({ attribute: false })
  public provider: AiProvider = mockBflProvider;

  @property({ attribute: 'l10n', type: Object })
  public l10nOverrides: Partial<typeof enLocale> = {};

  @state()
  private _prompt = '';

  @state()
  private _historyOpen = false;

  @query('uc-ai-prompt-row')
  private _promptRow?: UcAiPromptRow;

  private readonly _gen = new GenerationController(this);

  public override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('mode')) {
      const allowed = CAPABILITIES_FOR_MODE[this.mode];
      if (!allowed.includes(this.capability)) {
        this.capability = allowed[0] ?? 'generate';
      }
    }
    if (changed.has('src')) {
      this._gen.reset();
    }
  }

  private _l(key: keyof typeof enLocale): string {
    return translate(key, this.l10nOverrides);
  }

  private get _displayUrl(): string | null {
    return this._gen.resultUrl ?? this.src;
  }

  private async _generate(): Promise<void> {
    const prompt = this._prompt.trim();
    if (!prompt) return;
    try {
      await this._gen.run({
        provider: this.provider,
        prompt,
        capability: this.capability,
        sourceUrl: this._gen.resultUrl ?? this.src ?? undefined,
      });
    } catch (err) {
      this.dispatchEvent(new CustomEvent('uc:error', { detail: { error: err }, bubbles: true, composed: true }));
    }
  }

  private _onPromptInput(e: CustomEvent<PromptInputDetail>): void {
    this._prompt = e.detail.value;
  }

  private _onSend(): void {
    void this._generate();
  }

  private _onToggleHistory(): void {
    this._historyOpen = !this._historyOpen;
  }

  private _onSelectHistoryEntry(e: CustomEvent<HistorySelectDetail>): void {
    const { entry } = e.detail;
    this._prompt = entry.prompt;
    this.capability = entry.capability;
    this._gen.setResult(entry.url);
    this._historyOpen = false;
  }

  private _onCloseHistory(): void {
    this._historyOpen = false;
  }

  private _onSelectTemplate(e: CustomEvent<TemplateSelectDetail>): void {
    const { template } = e.detail;
    this.capability = template.capability;
    this._prompt = template.prompt;
    if (template.prompt && this.mode === 'edit') {
      void this._generate();
    } else {
      queueMicrotask(() => this._promptRow?.focusInput());
    }
  }

  private _onPrimary(): void {
    if (this.mode === 'edit') {
      const url = this._displayUrl;
      if (!url) return;
      const detail: ApplyDetail = { url, prompt: this._prompt, capability: this.capability };
      this.dispatchEvent(new CustomEvent('uc:apply', { detail, bubbles: true, composed: true }));
    } else {
      void this._generate();
    }
  }

  private _onBack(): void {
    this.dispatchEvent(new CustomEvent('uc:cancel', { bubbles: true, composed: true }));
  }

  public override render(): TemplateResult {
    const placeholderKey = CAPABILITIES[this.capability].placeholderKey as keyof typeof enLocale;
    const primaryLabelKey = this.mode === 'edit' ? 'ai-enhancer-done-btn' : 'ai-enhancer-generate-btn';
    const primaryDisabled =
      this.mode === 'edit' ? this._gen.busy || !this._displayUrl : this._gen.busy || !this._prompt.trim();

    return html`
      <div
        class="shell"
        role="region"
        aria-label="${this._l(this.mode === 'edit' ? 'ai-enhancer-edit-title' : 'ai-enhancer-generate-title')}"
      >
        <div class="body">
          <uc-ai-canvas
            .url=${this._displayUrl}
            .busy=${this._gen.busy}
            .alt=${this._prompt}
            busy-label="${this._l('ai-enhancer-busy')}"
            empty-hint="Your image will appear here"
          ></uc-ai-canvas>
          ${this._gen.error ? html`<div class="error-banner" role="alert">${this._gen.error}</div>` : nothing}
          <div class="bottom">
            <div class="history-wrap">
              <uc-ai-prompt-row
                .mode=${this.mode}
                .value=${this._prompt}
                .placeholder=${this._l(placeholderKey)}
                .busy=${this._gen.busy}
                ?history-open=${this._historyOpen}
                history-aria-label="${this._l('ai-enhancer-history-title')}"
                send-aria-label="${this._l('ai-enhancer-generate-btn')}"
                @uc:input=${this._onPromptInput}
                @uc:send=${this._onSend}
                @uc:toggle-history=${this._onToggleHistory}
              ></uc-ai-prompt-row>
              <uc-ai-history-popover
                ?open=${this._historyOpen}
                .entries=${this._gen.history}
                empty-label="${this._l('ai-enhancer-history-empty')}"
                @uc:select=${this._onSelectHistoryEntry}
                @uc:close=${this._onCloseHistory}
              ></uc-ai-history-popover>
            </div>
            <uc-ai-chips
              .mode=${this.mode}
              .capability=${this.capability}
              .prompt=${this._prompt}
              .busy=${this._gen.busy}
              @uc:select=${this._onSelectTemplate}
            ></uc-ai-chips>
          </div>
        </div>
        <uc-ai-footer
          back-label="${this._l('ai-enhancer-back')}"
          primary-label="${this._l(primaryLabelKey)}"
          ?primary-disabled=${primaryDisabled}
          @uc:back=${this._onBack}
          @uc:primary=${this._onPrimary}
        ></uc-ai-footer>
      </div>
    `;
  }
}

if (!customElements.get('uc-ai-editor')) {
  customElements.define('uc-ai-editor', UcAiEditor);
}
