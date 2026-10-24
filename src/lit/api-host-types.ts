import type { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import type { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import type { EventPayload, EventType } from '../blocks/UploadCtxProvider/EventEmitter';

/**
 * Instance surface contributed by {@link WithApi} — the documented public API +
 * collection getters that used to live only on `<uc-upload-ctx-provider>`.
 */
export interface ApiHost {
  getAPI(): UploaderPublicApi;
  readonly api: UploaderPublicApi;
  readonly uploadCollection: UploadCollectionController;
}

/** Typed DOM listeners for the documented uploader events re-dispatched by {@link WithApi}. */
export type ApiHostEventListenerMap = {
  [K in (typeof EventType)[keyof typeof EventType]]: (e: CustomEvent<EventPayload[K]>) => void;
};
