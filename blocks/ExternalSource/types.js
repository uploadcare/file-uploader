// @ts-check

/**
 * @typedef {{
 *   error?: undefined;
 *   alternatives?: Record<string, string>;
 *   is_image?: boolean | null;
 *   filename?: string;
 *   obj_type: 'selected_file';
 *   url: string;
 * }} DoneSuccessResponse
 */

/**
 * @typedef {{
 *   'selected-files-change': {
 *     type: 'selected-files-change';
 *     total: number;
 *     selectedCount: number;
 *   } & (
 *     | {
 *         isReady: false;
 *         isMultipleMode: boolean;
 *         selectedFiles: undefined;
 *       }
 *     | {
 *         isReady: true;
 *         isMultipleMode: true;
 *         selectedFiles: DoneSuccessResponse[];
 *       }
 *     | {
 *         isReady: true;
 *         isMultipleMode: false;
 *         selectedFiles: [DoneSuccessResponse] | [];
 *       }
 *   );
 *   'toolbar-state-change': {
 *     type: 'toolbar-state-change';
 *     isVisible: boolean;
 *   };
 * }} InputMessageMap
 */

/** @typedef {keyof InputMessageMap} InputMessageType */
/** @typedef {InputMessageMap[InputMessageType]} InputMessage */

/**
 * @template {import('./types').InputMessageType} T
 * @typedef {(message: import('./types').InputMessageMap[T]) => void} InputMessageHandler
 */

/**
 * @typedef {{
 *   '--uc-font-family': string;
 *   '--uc-font-size': string;
 *   '--uc-line-height': string;
 *   '--uc-button-size': string;
 *   '--uc-preview-size': string;
 *   '--uc-input-size': string;
 *   '--uc-padding': string;
 *   '--uc-radius': string;
 *   '--uc-transition': string;
 *   '--uc-background': string;
 *   '--uc-foreground': string;
 *   '--uc-primary': string;
 *   '--uc-primary-hover': string;
 *   '--uc-primary-transparent': string;
 *   '--uc-primary-foreground': string;
 *   '--uc-secondary': string;
 *   '--uc-secondary-hover': string;
 *   '--uc-secondary-foreground': string;
 *   '--uc-muted': string;
 *   '--uc-muted-foreground': string;
 *   '--uc-destructive': string;
 *   '--uc-destructive-foreground': string;
 *   '--uc-border': string;
 *   '--uc-primary-rgb-light': string;
 *   '--uc-primary-light': string;
 *   '--uc-primary-hover-light': string;
 *   '--uc-primary-transparent-light': string;
 *   '--uc-background-light': string;
 *   '--uc-foreground-light': string;
 *   '--uc-primary-foreground-light': string;
 *   '--uc-secondary-light': string;
 *   '--uc-secondary-hover-light': string;
 *   '--uc-secondary-foreground-light': string;
 *   '--uc-muted-light': string;
 *   '--uc-muted-foreground-light': string;
 *   '--uc-destructive-light': string;
 *   '--uc-destructive-foreground-light': string;
 *   '--uc-border-light': string;
 *   '--uc-primary-rgb-dark': string;
 *   '--uc-primary-dark': string;
 *   '--uc-primary-hover-dark': string;
 *   '--uc-primary-transparent-dark': string;
 *   '--uc-background-dark': string;
 *   '--uc-foreground-dark': string;
 *   '--uc-primary-foreground-dark': string;
 *   '--uc-secondary-dark': string;
 *   '--uc-secondary-hover-dark': string;
 *   '--uc-secondary-foreground-dark': string;
 *   '--uc-muted-dark': string;
 *   '--uc-muted-foreground-dark': string;
 *   '--uc-destructive-dark': string;
 *   '--uc-destructive-foreground-dark': string;
 *   '--uc-border-dark': string;
 *   '--uc-primary-oklch-light': string;
 *   '--uc-primary-oklch-dark': string;
 * }} ThemeDefinition
 */

/**
 * @typedef {{
 *       type: 'select-all';
 *     }
 *   | {
 *       type: 'deselect-all';
 *     }
 *   | {
 *       type: 'set-theme-definition';
 *       theme: Record<string, string>;
 *     }
 *   | {
 *       type: 'set-locale-definition';
 *       localeDefinition: string;
 *     }
 *   | {
 *       type: 'set-embed-css';
 *       css: string;
 *     }} OutputMessage
 */

export {};
