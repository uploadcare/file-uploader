import { describe, expectTypeOf, it } from 'vitest';
import type { UploaderEventKey, UploaderEventPayload, UploaderEventType } from '../../abstract/EventBus';
import type { ActivityType, RegisteredActivityType } from '../../lit/activity-constants';
import type { OutputCollectionState, OutputFileEntry } from '../../types';
import type { EventKey, EventPayload, EventType } from './EventEmitter';

// Type-level ("tsd"-style) tests via vitest `expectTypeOf` — checked by
// `tsc:test`. They are the migration guards for the event surface: a payload
// change or a divergence between the documented (v1) names and the canonical
// `EventBus` map fails the build, not just a runtime assertion.
describe('event type contract', () => {
  it('re-exports the canonical EventBus surface (single source of truth)', () => {
    expectTypeOf<typeof EventType>().toEqualTypeOf<typeof UploaderEventType>();
    expectTypeOf<EventKey>().toEqualTypeOf<UploaderEventKey>();
    expectTypeOf<EventPayload>().toEqualTypeOf<UploaderEventPayload>();
  });

  it('every documented event key is present on the bus payload map', () => {
    expectTypeOf<EventKey>().toEqualTypeOf<keyof UploaderEventPayload>();
  });

  it('locks the documented payload shapes', () => {
    expectTypeOf<EventPayload['file-added']>().toEqualTypeOf<OutputFileEntry<'idle'>>();
    expectTypeOf<EventPayload['file-upload-start']>().toEqualTypeOf<OutputFileEntry<'uploading'>>();
    expectTypeOf<EventPayload['file-upload-success']>().toEqualTypeOf<OutputFileEntry<'success'>>();
    expectTypeOf<EventPayload['file-upload-failed']>().toEqualTypeOf<OutputFileEntry<'failed'>>();
    expectTypeOf<EventPayload['modal-open']>().toEqualTypeOf<{ modalId: RegisteredActivityType }>();
    expectTypeOf<EventPayload['modal-close']>().toEqualTypeOf<{
      modalId: RegisteredActivityType;
      hasActiveModals: boolean;
    }>();
    expectTypeOf<EventPayload['activity-change']>().toEqualTypeOf<{ activity: ActivityType }>();
    expectTypeOf<EventPayload['upload-click']>().toEqualTypeOf<undefined>();
    expectTypeOf<EventPayload['done-click']>().toEqualTypeOf<OutputCollectionState>();
    expectTypeOf<EventPayload['common-upload-start']>().toEqualTypeOf<OutputCollectionState<'uploading'>>();
    expectTypeOf<EventPayload['change']>().toEqualTypeOf<OutputCollectionState>();
    expectTypeOf<EventPayload['group-created']>().toEqualTypeOf<OutputCollectionState<'success', 'has-group'>>();
  });
});
