import type { ActivityType } from '../../abstract/ActivityBlock';
import type { Block } from '../../abstract/Block';
import type { ModalId } from '../../abstract/managers/ModalManager';
import type { OutputCollectionState, OutputFileEntry } from '../../types';

const DEFAULT_DEBOUNCE_TIMEOUT = 20;

export const InternalEventType = Object.freeze({
  INIT_SOLUTION: 'init-solution',
  CHANGE_CONFIG: 'change-config',
  ACTION_EVENT: 'action-event',
} as const);

export const EventType = Object.freeze({
  FILE_ADDED: 'file-added',
  FILE_REMOVED: 'file-removed',
  FILE_UPLOAD_START: 'file-upload-start',
  FILE_UPLOAD_PROGRESS: 'file-upload-progress',
  FILE_UPLOAD_SUCCESS: 'file-upload-success',
  FILE_UPLOAD_FAILED: 'file-upload-failed',
  FILE_URL_CHANGED: 'file-url-changed',

  MODAL_OPEN: 'modal-open',
  MODAL_CLOSE: 'modal-close',
  DONE_CLICK: 'done-click',
  UPLOAD_CLICK: 'upload-click',
  ACTIVITY_CHANGE: 'activity-change',

  COMMON_UPLOAD_START: 'common-upload-start',
  COMMON_UPLOAD_PROGRESS: 'common-upload-progress',
  COMMON_UPLOAD_SUCCESS: 'common-upload-success',
  COMMON_UPLOAD_FAILED: 'common-upload-failed',

  CHANGE: 'change',
  GROUP_CREATED: 'group-created',

  ...InternalEventType,
} as const);

export type EventKey = (typeof EventType)[keyof typeof EventType];

export type EventPayload = {
  [EventType.FILE_ADDED]: OutputFileEntry<'idle'>;
  [EventType.FILE_REMOVED]: OutputFileEntry<'removed'>;
  [EventType.FILE_UPLOAD_START]: OutputFileEntry<'uploading'>;
  [EventType.FILE_UPLOAD_PROGRESS]: OutputFileEntry<'uploading'>;
  [EventType.FILE_UPLOAD_SUCCESS]: OutputFileEntry<'success'>;
  [EventType.FILE_UPLOAD_FAILED]: OutputFileEntry<'failed'>;
  [EventType.FILE_URL_CHANGED]: OutputFileEntry<'success'>;
  [EventType.MODAL_OPEN]: { modalId: ModalId };
  [EventType.MODAL_CLOSE]: {
    modalId: ModalId;
    hasActiveModals: boolean;
  };
  [EventType.ACTIVITY_CHANGE]: {
    activity: ActivityType;
  };
  [EventType.UPLOAD_CLICK]: void;
  [EventType.DONE_CLICK]: OutputCollectionState;
  [EventType.COMMON_UPLOAD_START]: OutputCollectionState<'uploading'>;
  [EventType.COMMON_UPLOAD_PROGRESS]: OutputCollectionState<'uploading'>;
  [EventType.COMMON_UPLOAD_SUCCESS]: OutputCollectionState<'success'>;
  [EventType.COMMON_UPLOAD_FAILED]: OutputCollectionState<'failed'>;
  [EventType.CHANGE]: OutputCollectionState;
  [EventType.GROUP_CREATED]: OutputCollectionState<'success', 'has-group'>;
  [EventType.INIT_SOLUTION]: void;
  [EventType.CHANGE_CONFIG]: void;
  [EventType.ACTION_EVENT]: {
    metadata: Record<string, unknown>;
  };
};

export class EventEmitter {
  private _timeoutStore: Map<string, number> = new Map();
  private _targets: Set<Block> = new Set();
  private _debugPrint: ((...args: unknown[]) => void) | null = null;

  constructor(debugPrint: (...args: unknown[]) => void) {
    this._debugPrint = debugPrint;
  }

  bindTarget(target: Block): void {
    this._targets.add(target);
  }

  unbindTarget(target: Block): void {
    this._targets.delete(target);
  }

  private _dispatch<T extends EventKey>(type: T, payload?: EventPayload[T]): void {
    for (const target of this._targets) {
      target.dispatchEvent(
        new CustomEvent(type, {
          detail: payload,
        }),
      );
    }

    this._debugPrint?.(() => {
      const copyPayload = !!payload && typeof payload === 'object' ? { ...payload } : payload;
      return [`event "${type}"`, copyPayload];
    });
  }

  emit<T extends EventKey, TDebounce extends boolean | number | undefined = undefined>(
    type: T,
    payload?: TDebounce extends false | undefined ? EventPayload[T] : () => EventPayload[T],
    options: { debounce?: TDebounce } = {},
  ): void {
    const { debounce } = options;
    if (typeof debounce !== 'number' && !debounce) {
      this._dispatch(type, typeof payload === 'function' ? payload() : (payload as EventPayload[T]));
      return;
    }

    if (this._timeoutStore.has(type)) {
      window.clearTimeout(this._timeoutStore.get(type));
    }
    const timeout = typeof debounce === 'number' ? debounce : DEFAULT_DEBOUNCE_TIMEOUT;
    const timeoutId = window.setTimeout(() => {
      this._dispatch(type, typeof payload === 'function' ? payload() : (payload as EventPayload[T]));
      this._timeoutStore.delete(type);
    }, timeout);
    this._timeoutStore.set(type, timeoutId);
  }
}
