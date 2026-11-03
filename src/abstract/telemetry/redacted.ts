import type { ConfigType, OutputCollectionState, OutputFileEntry } from '../../types/index';
import { redact } from '../../utils/redaction';
import { type EventBus, type UploaderEventKey, type UploaderEventPayload, UploaderEventType } from '../EventBus';

declare const redactedBrand: unique symbol;

/**
 * Data that went through one of the helpers below: what `TelemetryManager` accepts, so nothing reaches telemetry
 * unredacted. Opaque on purpose: telemetry sends it, it doesn't read it. What each helper hides is decided here and in
 * `utils/redaction.ts`, never in the manager.
 */
export type Redacted = Readonly<Record<string, unknown>> & { readonly [redactedBrand]: true };

// Where a value becomes `Redacted`: only after `redact` has copied it (and in `redactPayload`).
const toRedacted = (value: object): Redacted => redact(value) as unknown as Redacted;

/** A file entry, without its name, uuid, URLs, `File` or metadata. */
export const redactFileEntry = (entry: OutputFileEntry): Redacted => toRedacted(entry);

/** A collection state, with every entry and the group redacted like {@link redactFileEntry}. */
export const redactCollection = (state: OutputCollectionState): Redacted => toRedacted(state);

/** The config, without credentials, the rest of the signing/delivery setup and metadata. */
export const redactConfig = (config: ConfigType): Redacted => toRedacted(config);

/**
 * Any other payload (router ids, UI action detail), redacted by the same key rules. Its `metadata` is telemetry's field
 * for the event's detail, not the integrator's metadata, so it is redacted inside rather than hidden whole.
 */
export const redactPayload = ({ metadata, ...rest }: Record<string, unknown>): Redacted => {
  const payload = redact(rest);
  return (metadata === undefined ? payload : { ...payload, metadata: redact(metadata) }) as unknown as Redacted;
};

/** A UI action: `event` names it, `node` is the tag of the element that reported it. */
export const redactAction = (event: string, node: string | undefined, extra: Record<string, unknown> = {}): Redacted =>
  redactPayload({ metadata: { event, node, ...extra } });

/** An error, as the text of its context and message. */
export const redactError = (error: unknown, context: string): Redacted =>
  redactPayload({
    metadata: {
      event: 'error',
      text: `Error in ${context}`,
      // Non-`Error` throwables (strings, DOMException, …) have no `.message`; stringify them rather than reporting
      // `undefined`.
      error: error instanceof Error ? error.message : String(error),
    },
  });

/**
 * How each uploader event's payload is redacted. Every event needs an entry, so a new one fails to compile until it
 * says what of its payload may be sent.
 */
const EVENT_PAYLOADS: { [K in UploaderEventKey]: (payload: UploaderEventPayload[K]) => Redacted | undefined } = {
  'file-added': redactFileEntry,
  'file-removed': redactFileEntry,
  'file-upload-start': redactFileEntry,
  'file-upload-progress': redactFileEntry,
  'file-upload-success': redactFileEntry,
  'file-upload-failed': redactFileEntry,
  'file-url-changed': redactFileEntry,
  'modal-open': redactPayload,
  'modal-close': redactPayload,
  'activity-change': redactPayload,
  'upload-click': () => undefined,
  'done-click': redactCollection,
  'common-upload-start': redactCollection,
  'common-upload-progress': redactCollection,
  'common-upload-success': redactCollection,
  'common-upload-failed': redactCollection,
  change: redactCollection,
  'group-created': redactCollection,
};

/** Uploader events that are too frequent, or too per-file, to report to telemetry. */
export const SKIPPED_EVENTS: ReadonlySet<string> = new Set<UploaderEventKey>([
  UploaderEventType.CHANGE,
  UploaderEventType.COMMON_UPLOAD_PROGRESS,
  UploaderEventType.FILE_ADDED,
  UploaderEventType.FILE_REMOVED,
  UploaderEventType.FILE_UPLOAD_START,
  UploaderEventType.FILE_UPLOAD_PROGRESS,
  UploaderEventType.FILE_UPLOAD_SUCCESS,
  UploaderEventType.FILE_UPLOAD_FAILED,
]);

/**
 * Forwards every reported uploader event to `send` with its payload redacted, so the receiver never sees a raw one.
 * The payload is copied when the event fires (it can be getters over live state). Returns the unsubscribe.
 */
export const forwardRedactedEvents = (
  bus: EventBus,
  send: (eventType: UploaderEventKey, payload: Redacted | undefined) => void,
): (() => void) => {
  const forward = <K extends UploaderEventKey>(type: K) =>
    bus.on(type, (payload) => {
      // Skipped before the copy: the skipped events are the frequent ones (progress, change).
      if (SKIPPED_EVENTS.has(type)) return;
      send(type, payload === undefined ? undefined : EVENT_PAYLOADS[type](payload));
    });
  const unsubs = Object.values(UploaderEventType).map((type) => forward(type));
  return () => {
    for (const unsub of unsubs) unsub();
  };
};
