import { describe, expect, it, vi } from 'vitest';
import { REDACTED } from '../../utils/redaction';
import { ControllerContainer } from '../di/ControllerContainer';
import { EventBus, type UploaderEventKey, UploaderEventType } from '../EventBus';
import type { TelemetryEvent } from '../managers/TelemetryManager';
import {
  forwardRedactedEvents,
  type Redacted,
  redactAction,
  redactCollection,
  redactConfig,
  redactError,
  redactFileEntry,
  redactPayload,
  SKIPPED_EVENTS,
} from './redacted';

const entry = {
  status: 'success',
  name: 'private-name.png',
  size: 70,
  metadata: { userId: 'META' },
  uuid: 'f0e1-uuid',
  cdnUrl: 'https://abc.ucarecd.net/f0e1-uuid/',
  fileInfo: { uuid: 'f0e1-uuid', originalFilename: 'private-name.png', isImage: true },
  isSuccess: true,
};
const collection = {
  status: 'success',
  totalCount: 1,
  allEntries: [entry],
  successEntries: [entry],
  group: { uuid: 'group~1', cdnUrl: 'https://abc.ucarecd.net/group~1/' },
};

describe('telemetry redaction layer', () => {
  it('redacts a file entry: identity and metadata hidden, the rest kept', () => {
    expect(redactFileEntry(entry as never)).toEqual({
      status: 'success',
      name: REDACTED,
      size: 70,
      metadata: REDACTED,
      uuid: REDACTED,
      cdnUrl: REDACTED,
      fileInfo: { uuid: REDACTED, originalFilename: REDACTED, isImage: true },
      isSuccess: true,
    });
  });

  it('redacts a collection, its entries and its group', () => {
    const sent = redactCollection(collection as never);

    expect(sent).toMatchObject({ status: 'success', totalCount: 1, group: { uuid: REDACTED, cdnUrl: REDACTED } });
    expect(JSON.stringify(sent)).not.toMatch(/private-name|f0e1-uuid|group~1|META/);
  });

  it('redacts the config: credentials, signing setup and metadata; unset ones stay unset', () => {
    const sent = redactConfig({ pubkey: 'k', secureSignature: 's', secureExpire: '', metadata: { a: 1 } } as never);

    expect(sent).toEqual({ pubkey: 'k', secureSignature: REDACTED, secureExpire: '', metadata: REDACTED });
  });

  it("keeps telemetry's own metadata field and redacts inside it", () => {
    expect(redactAction('remove-file', 'UC-FILE-ITEM', { pluginId: 'p', name: 'cat.png' })).toEqual({
      metadata: { event: 'remove-file', node: 'UC-FILE-ITEM', pluginId: 'p', name: REDACTED },
    });
    expect(redactPayload({ modalId: 'start-from' })).toEqual({ modalId: 'start-from' });
    expect(redactError(new Error('boom'), 'upload')).toEqual({
      metadata: { event: 'error', text: 'Error in upload', error: 'boom' },
    });
  });

  it('forwards every reported bus event with its payload redacted, and skips the frequent ones', () => {
    const container = new ControllerContainer();
    const bus = container.get(EventBus);
    const send = vi.fn();
    const unsubscribe = forwardRedactedEvents(bus, send);

    bus.emit(UploaderEventType.COMMON_UPLOAD_SUCCESS, collection as never);
    bus.emit(UploaderEventType.FILE_URL_CHANGED, entry as never);
    bus.emit(UploaderEventType.UPLOAD_CLICK, undefined);
    bus.emit(UploaderEventType.COMMON_UPLOAD_PROGRESS, collection as never);
    bus.emit(UploaderEventType.CHANGE, collection as never);

    expect(send.mock.calls.map(([type]) => type)).toEqual([
      UploaderEventType.COMMON_UPLOAD_SUCCESS,
      UploaderEventType.FILE_URL_CHANGED,
      UploaderEventType.UPLOAD_CLICK,
    ]);
    expect(JSON.stringify(send.mock.calls)).not.toMatch(/private-name|f0e1-uuid|group~1|META/);
    expect(SKIPPED_EVENTS.has(UploaderEventType.CHANGE satisfies UploaderEventKey)).toBe(true);

    unsubscribe();
    bus.emit(UploaderEventType.COMMON_UPLOAD_SUCCESS, collection as never);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('only accepts redacted payloads at the telemetry boundary', () => {
    const ok: TelemetryEvent = {
      eventType: UploaderEventType.DONE_CLICK,
      payload: redactCollection(collection as never),
    };
    // @ts-expect-error a raw payload is not `Redacted`: it has to go through a helper first.
    const raw: TelemetryEvent = { eventType: UploaderEventType.DONE_CLICK, payload: collection };
    // @ts-expect-error nor can a plain object be passed off as one.
    const forged: Redacted = { a: 1 };

    expect([ok, raw, forged]).toHaveLength(3);
  });
});
