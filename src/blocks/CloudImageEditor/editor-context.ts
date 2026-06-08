import { createContext } from '@lit/context';
import type { EditorStateController } from './editor-state';

/**
 * Lightweight ambient services the editor sub-components used to read
 * off v1's `LitBlock` base (locale, secure-delivery proxy, telemetry).
 * Provided by `<uc-cloud-image-editor>` alongside the state controller
 * so sub-components don't have to consume the v2 `UploaderController`
 * directly — the editor decides what to surface and standalone tests
 * still work without any uploader in the tree.
 */
export type EditorServices = {
  /** v1's `this.l10n` — translate a key, optionally interpolating vars. */
  l10n: (key: string, vars?: Record<string, string | number>) => string;
  /** v1's `this.proxyUrl` — apply secure-delivery proxy if configured. */
  proxyUrl: (url: string) => Promise<string>;
  /** v1's `this.telemetryManager` — minimum surface CIE calls. */
  telemetry: {
    sendEventCloudImageEditor: (event: Event, tabId: string, payload?: Record<string, unknown>) => void;
    sendEventError: (err: unknown, message: string) => void;
  };
};

export type EditorContextValue = {
  state: EditorStateController;
  services: EditorServices;
};

/** Lit context token. Provided by `<uc-cloud-image-editor>`. */
export const editorContext = createContext<EditorContextValue>(Symbol('uc-cie-editor'));

/** Shared no-op telemetry implementation — used by every standalone or
 * uploader-less fallback so call sites don't have to null-check. */
export const NO_OP_TELEMETRY: EditorServices['telemetry'] = {
  sendEventCloudImageEditor: () => {},
  sendEventError: () => {},
};
