// @ts-check

/** @type {import('./types').InputMessageType[]} */
const MESSAGE_TYPE_WHITELIST = ['selected-files-change', 'toolbar-state-change'];

/**
 * @param {unknown} message
 * @returns {message is import("./types").InputMessageMap[import("./types").InputMessageType]}
 */
const isWhitelistedMessage = (message) => {
  if (!message) return false;
  if (typeof message !== 'object') return false;
  return (
    'type' in message &&
    MESSAGE_TYPE_WHITELIST.includes(/** @type {import('./types').InputMessageType} */ (message.type))
  );
};

export class MessageBridge {
  /** @type {Map<string, Set<import('./types').InputMessageHandler<import('./types').InputMessageType>>>} */
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
   * @template {import('./types').InputMessageType} T
   * @param {T} type
   * @param {import('./types').InputMessageHandler<T>} handler
   */
  on(type, handler) {
    const handlers = this._handlerMap.get(type) ?? new Set();
    if (!this._handlerMap.has(type)) {
      this._handlerMap.set(type, handlers);
    }

    handlers.add(/** @type {import('./types').InputMessageHandler<import('./types').InputMessageType>} */ (handler));
  }

  /** @param {import('./types').OutputMessage} message */
  send(message) {
    this._context.postMessage(message, '*');
  }

  destroy() {
    window.removeEventListener('message', this._handleMessage);
  }
}
