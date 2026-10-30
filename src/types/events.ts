import type { EventPayload } from '../abstract/EventEmitter';

export type EventMap = {
  [T in keyof EventPayload]: CustomEvent<EventPayload[T]>;
};
