import { ContextConsumer } from '@lit/context';
import { LitElement, type PropertyValues } from 'lit';
import { LightDomMixin } from '../../lit/LightDomMixin';
import { type EditorContextValue, type EditorServices, editorContext, NO_OP_TELEMETRY } from './editor-context';
import type { EditorState, EditorStateController } from './editor-state';

/**
 * Base class for every element inside `<uc-cloud-image-editor>`.
 * Replaces v1's `LitBlock` for the CIE sub-tree. Surfaces:
 *
 *  - `this.editor` → `EditorStateController` (typed `get` / `set` /
 *    `subscribe`); throws if read before the Lit context resolved.
 *  - `this.editorSubs` → an array helper for subclasses to declare
 *    `[key, callback]` pairs in `editorReady()`; auto-cleaned on
 *    disconnect.
 *  - `this.l10n` / `this.proxyUrl` / `this.telemetryManager` →
 *    delegating shims that match the v1 call shape so per-call-site
 *    code reads identically.
 *
 * Subclasses extend this directly (`extends EditorBlock`) instead of
 * `LitBlock`. The block renders into light DOM via `LightDomMixin` —
 * same as v1.
 */
const EditorBlockBase = LightDomMixin(LitElement);

export abstract class EditorBlock extends EditorBlockBase {
  private _editor: EditorContextValue | null = null;
  private _editorUnsubs: Array<() => void> = [];
  private _isInited = false;
  private _pendingInit = false;

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: `ContextConsumer` works by side-effect — constructing it subscribes the host to the upstream `<uc-cloud-image-editor>` provider and runs the callback. The field reference keeps it alive for the host's lifetime.
  private readonly _consumer = new ContextConsumer(this, {
    context: editorContext,
    subscribe: true,
    callback: (value) => {
      this._editor = value ?? null;
      // The context may flip after firstUpdated() has already run, so
      // give subclasses one more shot at wiring once it arrives.
      if (this._pendingInit && this._editor) this._runInit();
    },
  });

  /**
   * Resolved editor context. Throws if accessed before
   * `editorReady()` — sub-components mounted as children of
   * `<uc-cloud-image-editor>` always see it by the time
   * `editorReady` fires.
   */
  protected get editor(): EditorStateController {
    if (!this._editor) {
      throw new Error(
        `${this.tagName.toLowerCase()}: editor context not yet provided. ` + 'Mount inside <uc-cloud-image-editor>.',
      );
    }
    return this._editor.state;
  }

  /** Same `editor`, but returns null when not yet resolved. */
  protected get editorOrNull(): EditorStateController | null {
    return this._editor?.state ?? null;
  }

  protected get services(): EditorServices | null {
    return this._editor?.services ?? null;
  }

  /**
   * v1-compatible `l10n(key, vars?)`. Falls back to the key when no
   * context is provided yet (i.e. for elements whose property setters
   * call l10n before connect). Matches v1's "return key on miss"
   * semantics.
   */
  protected l10n(key: string, vars?: Record<string, string | number>): string {
    return this._editor?.services.l10n(key, vars) ?? key;
  }

  /**
   * v1-compatible `proxyUrl(url)`. Returns the input URL when no
   * services are wired (standalone tests without `<uc-config>`'s
   * `secureDeliveryProxy`).
   */
  protected proxyUrl(url: string): Promise<string> {
    return this._editor?.services.proxyUrl(url) ?? Promise.resolve(url);
  }

  /** v1-compatible `this.telemetryManager`. No-op when unavailable. */
  protected get telemetryManager(): EditorServices['telemetry'] {
    return this._editor?.services.telemetry ?? NO_OP_TELEMETRY;
  }

  /**
   * Called once the editor context is available. Subclasses override
   * this to set up `editor.subscribe(...)` calls and any imperative
   * mount work (the v1 equivalent was `initCallback()` /
   * `connectedCallback`).
   */
  protected editorReady(_editor: EditorStateController): void {}

  /**
   * Convenience: subscribe a callback to a single editor key. The
   * listener is invoked immediately with the current value (v1's
   * `this.sub(key, cb)` semantics — fire on register + on change),
   * and again on every change. Pass `{ immediate: false }` to skip
   * the initial fire. The unsub is stored for automatic cleanup on
   * disconnect.
   */
  protected subscribeKey<K extends keyof EditorState>(
    key: K,
    listener: (value: EditorState[K]) => void,
    options: { immediate?: boolean } = {},
  ): void {
    const editor = this.editorOrNull;
    if (!editor) return;
    const fire = (): void => listener(editor.get(key));
    this._editorUnsubs.push(editor.subscribe(key, fire));
    if (options.immediate !== false) {
      try {
        fire();
      } catch (err) {
        console.warn(`[v2/cie] initial listener for "${String(key)}" threw`, err);
      }
    }
  }

  public override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed);
    if (this._editor) {
      this._runInit();
    } else {
      // Context hasn't arrived yet — `_consumer` callback will fire
      // `_runInit` once it does.
      this._pendingInit = true;
    }
  }

  private _runInit(): void {
    this._pendingInit = false;
    if (this._isInited) return;
    this._isInited = true;
    // Reflect `testMode → data-testid` on every CIE descendant. Editor's
    // outer block sets `*testMode` from its own attribute / uploader
    // controller; children consume here.
    this.subscribeKey('*testMode', () => this._syncTestId());
    this.editorReady(this.editor);
  }

  private _syncTestId(): void {
    if (this.editor.get('*testMode')) {
      this.setAttribute('data-testid', this.tagName.toLowerCase());
    } else {
      this.removeAttribute('data-testid');
    }
  }

  public override disconnectedCallback(): void {
    for (const unsub of this._editorUnsubs) {
      try {
        unsub();
      } catch (err) {
        console.warn(`[v2/cie] ${this.tagName.toLowerCase()} teardown failed`, err);
      }
    }
    this._editorUnsubs = [];
    this._isInited = false;
    this._pendingInit = false;
    super.disconnectedCallback();
  }
}
