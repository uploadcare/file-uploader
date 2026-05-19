import type { InputMessageHandler, InputMessageMap, InputMessageType, OutputMessage } from './types';

const MESSAGE_TYPE_WHITELIST: InputMessageType[] = ['selected-files-change', 'toolbar-state-change'];

const isWhitelistedMessage = (message: unknown): message is InputMessageMap[InputMessageType] => {
  if (!message) return false;
  if (typeof message !== 'object') return false;
  if (!('type' in message)) return false;

  const type = (message as { type?: unknown }).type;
  if (typeof type !== 'string') return false;
  if (!MESSAGE_TYPE_WHITELIST.includes(type as InputMessageType)) return false;

  return true;
};

export class MessageBridge {
  private _handlerMap = new Map<InputMessageType, Set<InputMessageHandler<InputMessageType>>>();

  private _context: Window;

  private _getTargetOrigin: () => string;

  public constructor(context: Window, getTargetOrigin: () => string) {
    this._context = context;
    this._getTargetOrigin = getTargetOrigin;

    window.addEventListener('message', this._handleMessage);
  }

  private _handleMessage = (e: MessageEvent) => {
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

  public on<T extends InputMessageType>(type: T, handler: InputMessageHandler<T>) {
    const handlers = this._handlerMap.get(type) ?? new Set<InputMessageHandler<InputMessageType>>();
    if (!this._handlerMap.has(type)) {
      this._handlerMap.set(type, handlers);
    }

    handlers.add(handler as InputMessageHandler<InputMessageType>);
  }

  public send(message: OutputMessage) {
    const targetOrigin = this._getTargetOrigin();
    this._context.postMessage(message, targetOrigin);
  }

  public destroy() {
    window.removeEventListener('message', this._handleMessage);
  }
}
