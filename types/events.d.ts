import type { GlobalEventPayload } from '../blocks/UploadCtxProvider/EventEmitter';

type CustomEventMap = {
  [T in keyof GlobalEventPayload]: CustomEvent<GlobalEventPayload[T]>;
};
declare global {
  interface Window {
    addEventListener<T extends keyof CustomEventMap>(
      type: T,
      listener: (e: CustomEventMap[T]) => void,
      options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener<T extends keyof CustomEventMap>(
      type: T,
      listener: (e: CustomEventMap[T]) => void,
      options?: boolean | EventListenerOptions
    ): void;
  }
}

export {};
