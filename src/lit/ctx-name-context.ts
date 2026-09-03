import { createContext } from '@lit/context';

/**
 * `@lit/context` token carrying the shared `ctx-name` down the element tree, so
 * a descendant without its own `ctx-name` attribute resolves the nearest
 * ancestor's. Consumed by `ChildBlock`, `ensureUploaderCtx`, and
 * `<uc-cloud-image-editor>`.
 */
export const ctxNameContext = createContext<string>('ctx-name-context');
