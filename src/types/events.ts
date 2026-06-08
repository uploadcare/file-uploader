import type { UploaderEventPayload } from '../abstract/EventBus';

export type EventMap = {
  [T in keyof UploaderEventPayload]: CustomEvent<UploaderEventPayload[T]>;
};
