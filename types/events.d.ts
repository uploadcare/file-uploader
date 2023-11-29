import type { GlobalEventPayload, EventPayload } from '../blocks/UploadCtxProvider/EventEmitter';

export type GlobalEventMap = {
  [T in keyof GlobalEventPayload]: CustomEvent<GlobalEventPayload[T]>;
};

export type EventMap = {
  [T in keyof EventPayload]: CustomEvent<EventPayload[T]>;
};

declare global {
  interface Window {
    addEventListener<T extends keyof GlobalEventMap>(
      type: T,
      listener: (e: GlobalEventMap[T]) => void,
      options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener<T extends keyof GlobalEventMap>(
      type: T,
      listener: (e: GlobalEventMap[T]) => void,
      options?: boolean | EventListenerOptions
    ): void;
  }
}

export {};
