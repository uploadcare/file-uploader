// @ts-check

/**
 * @typedef {{
 *   caption?: string | null;
 *   created: number;
 *   id: string;
 *   public_page?: string;
 *   username: string;
 *   size?: number;
 *   name?: string;
 *   modified?: number;
 * }} InstagramInfo
 */

/**
 * @typedef {{
 *   error?: undefined;
 *   info?: InstagramInfo;
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
 * }} InputMessageMap
 */

/** @typedef {keyof InputMessageMap} InputMessageType */
/** @typedef {InputMessageMap[InputMessageType]} InputMessage */

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
 *       type: 'set-embed-css';
 *       css: Partial<ThemeDefinition>;
 *     }} OutputMessage
 */

/** @type {InputMessageType[]} */
const MESSAGE_TYPE_WHITELIST = ['selected-files-change'];

/**
 * @template {InputMessageType} T
 * @typedef {(message: InputMessageMap[T]) => void} InputMessageHandler
 */

/**
 * @param {unknown} message
 * @returns {message is InputMessageMap[InputMessageType]}
 */
const isWhitelistedMessage = (message) => {
  if (!message) return false;
  if (typeof message !== 'object') return false;
  return 'type' in message && MESSAGE_TYPE_WHITELIST.includes(/** @type {InputMessageType} */ (message.type));
};

export class MessageBridge {
  /** @type {Map<string, Set<InputMessageHandler<InputMessageType>>>} */
  _handlerMap = new Map();

  /** @type {Window} */
  _context;

  /** @param {Window} context */
  constructor(context) {
    this._context = context;

    window.addEventListener('message', this._handleMessage);
  }

  /** @param {MessageEvent} e */
  _handleMessage = (e) => {
    if (e.source !== this._context) {
      return;
    }
    const message = e.data;
    if (!isWhitelistedMessage(message)) {
      return;
    }

    const handlers = this._handlerMap.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(message);
      }
    }
  };

  /**
   * @template {InputMessageType} T
   * @param {T} type
   * @param {InputMessageHandler<T>} handler
   */
  on(type, handler) {
    const handlers = this._handlerMap.get(type) ?? new Set();
    if (!this._handlerMap.has(type)) {
      this._handlerMap.set(type, handlers);
    }

    handlers.add(/** @type {InputMessageHandler<InputMessageType>} */ (handler));
  }

  /** @param {OutputMessage} message */
  send(message) {
    this._context.postMessage(message, '*');
  }

  destroy() {
    window.removeEventListener('message', this._handleMessage);
  }
}
