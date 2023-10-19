// TODO: Add event types
interface CustomEventMap {
  UPLOAD_START: CustomEvent<any>;
  REMOVE: CustomEvent<any>;
  UPLOAD_PROGRESS: CustomEvent<any>;
  UPLOAD_FINISH: CustomEvent<any>;
  UPLOAD_ERROR: CustomEvent<any>;
  VALIDATION_ERROR: CustomEvent<any>;
  CLOUD_MODIFICATION: CustomEvent<any>;
  DATA_OUTPUT: CustomEvent<any>;
  DONE_FLOW: CustomEvent<any>;
  INIT_FLOW: CustomEvent<any>;
}
declare global {
  interface Window {
    addEventListener<K extends keyof CustomEventMap>(type: `LR_${K}`, listener: (e: CustomEventMap[K]) => void): void;
    removeEventListener<K extends keyof CustomEventMap>(
      type: `LR_${K}`,
      listener: (e: CustomEventMap[K]) => void
    ): void;
  }
}

export {};