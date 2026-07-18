import type { Uid } from '../../lit/Uid';
import type { OutputCollectionState, OutputFileEntry, OutputFileStatus, UploaderPublicApi } from '../../types';
import type { UploaderEventKey, UploaderEventPayload } from '../EventBus';
import type { Owned, PluginFileHookRegistration } from '../managers/plugin/PluginTypes';
import type { TypedData } from '../TypedData';
import type { UploadEntryData } from '../uploadEntrySchema';

/** Pure event dispatch — reaches the EventBus; telemetry observes that bus independently. */
export type UploadHostEmit = <T extends UploaderEventKey>(
  type: T,
  payload?: UploaderEventPayload[T] | (() => UploaderEventPayload[T]),
  options?: { debounce?: boolean | number },
) => void;

/** Debug logger — wired to the block's `debugPrint` at the DOM boundary. */
export type UploadHostDebug = (...args: unknown[]) => void;

/**
 * The element/DOM-layer values the upload stack needs — everything that can
 * only be resolved from the shared instances `bag` (the public API, plugin
 * hooks, output-state readers, the host `emit`, and the telemetry error sinks).
 *
 * It is a DI token first and foremost: `ensureUploaderScope` (element layer)
 * `bind`s a concrete instance built by `buildUploaderScopeDeps`, and the four
 * upload-stack controllers `@inject(UploadHostBridge)` it. Its members are
 * `declare`-only (type-level, no runtime body): the class exists purely as the
 * container token + the structural type the bound factory's object literal
 * satisfies — it is never `new`-ed (the container resolves it through its bound
 * factory). A concrete (non-abstract) class so it stays assignable as a
 * `Token<T>` (an abstract constructor is not).
 *
 * Controller peers (config, collection, secure-uploads, validation, upload,
 * collection-state) are NOT here — those are `@inject`-ed controller-to-
 * controller. This bridge is strictly the host boundary.
 */
export class UploadHostBridge {
  /** Debug logger — shared by secure-uploads + upload controllers. */
  public declare readonly debug: UploadHostDebug;
  /** Snapshot of the registered plugin file hooks (`PluginController`). */
  public declare readonly getFileHooks: () => readonly Owned<PluginFileHookRegistration>[];
  /** Resolves the public output entry (`UploaderPublicApi.getOutputItem`). */
  public declare readonly getOutputItem: <TStatus extends OutputFileStatus>(uid: Uid) => OutputFileEntry<TStatus>;
  /** The public API passed to validators (`UploaderPublicApi`). */
  public declare readonly getApi: () => UploaderPublicApi;
  /** Fires the debounced `common-upload-failed` event (`EventEmitter` + `UploaderPublicApi`). */
  public declare readonly emitCommonUploadFailed: () => void;
  /** Host `emit` — pure EventEmitter dispatch, guarded for teardown races. */
  public declare readonly emit: UploadHostEmit;
  /** Current output collection state (`UploaderPublicApi.getOutputCollectionState`). */
  public declare readonly getOutputCollectionState: () => OutputCollectionState;
  /** Current output entries (`getOutputData(container)`). */
  public declare readonly getOutputData: () => OutputFileEntry[];
  /** Runs plugin `onAdd` hooks (`container.whenController(PluginController)`). */
  public declare readonly runOnAddHooks: (entry: TypedData<UploadEntryData>) => void;
  /** Telemetry sink for a signature resolver that throws (never throws itself). */
  public declare readonly onResolverError: (error: unknown, context: string) => void;
  /** Telemetry sink for a non-cancel upload failure (never throws itself). */
  public declare readonly onUploadError: (error: unknown, context: string) => void;
  /** Telemetry sink for a validator that throws (never throws itself). */
  public declare readonly onValidatorError: (error: unknown, context: string) => void;
}
