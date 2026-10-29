import { vi } from 'vitest';
import { DEFAULT_EDITOR_CONFIG, type EditorServices } from '../CloudImageEditorController';
import type { PresenceToggle } from '../elements/presence-toggle/PresenceToggle';

/** Inert `EditorServices`: key-echoing l10n, the default config, spied telemetry. Override any member. */
export const stubEditorServices = (overrides: Partial<EditorServices> = {}): EditorServices => ({
  l10n: (key) => key,
  getConfig: (key) => DEFAULT_EDITOR_CONFIG[key],
  telemetry: { sendEvent: vi.fn(), sendEventError: vi.fn(), sendActionEvent: vi.fn() },
  proxyUrl: async (url) => url,
  ...overrides,
});

/** Whether the editor shows its network problems screen. */
export const networkSplashVisible = (editor: Element): boolean | undefined =>
  editor.querySelector<PresenceToggle>('.uc-network_problems_splash')?.visible;

/** Activation draws the image and marks the element `uc-active_from_*`, so the class is the "it really works" signal. */
export const activeClass = (element: Element | null | undefined): string => element?.className ?? '';
