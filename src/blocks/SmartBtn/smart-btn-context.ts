import { createContext } from '@lit/context';

/**
 * Context to communicate whether SmartBtn is active (present on the page).
 * When SmartBtn is active, sources should not auto-open the upload list,
 * and should close their own activity/modal after file selection.
 */
export const smartBtnActiveContext = createContext<boolean>('smart-btn-active');
