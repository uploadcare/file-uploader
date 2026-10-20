import '../jsx';
import type { LitElement } from 'lit';
import { expectTypeOf, test } from 'vitest';
import type * as UC from '../../dist/index';
import type { EventMap, KebabCase, UploadCtxProvider } from '../../dist/index';

/**
 * Drift guards over the public surface. Each one fails when a list that is maintained by hand falls behind the code:
 * a block exported without a JSX entry, an event added without a payload type, a documented method dropped.
 */

type Exports = typeof UC;

/** Base classes are exported for subclassing and never registered as tags (`defineComponents` skips them). */
type BaseClass = 'Block' | 'SolutionBlock' | 'UploaderBlock' | 'ActivityBlock' | 'BaseComponent';

/** Every exported custom element class, by export name. */
type BlockName = {
  [K in keyof Exports]: K extends BaseClass ? never : Exports[K] extends new () => LitElement ? K : never;
}[keyof Exports];

/** The tag `defineComponents` derives from the class name. */
type BlockTag = `uc-${KebabCase<Uncapitalize<BlockName>>}`;

test('every exported block has a JSX entry', () => {
  expectTypeOf<Exclude<BlockTag, keyof JSX.IntrinsicElements>>().toBeNever();
});

test('every exported block is in HTMLElementTagNameMap', () => {
  expectTypeOf<Exclude<BlockTag, keyof HTMLElementTagNameMap>>().toBeNever();
});

// The 18 events documented in fern-docs `events.mdx` (specs/public-api/public-surface.json).
type DocumentedEvent =
  | 'file-added'
  | 'file-removed'
  | 'file-upload-start'
  | 'file-upload-progress'
  | 'file-upload-success'
  | 'file-upload-failed'
  | 'file-url-changed'
  | 'modal-open'
  | 'modal-close'
  | 'done-click'
  | 'upload-click'
  | 'activity-change'
  | 'common-upload-start'
  | 'common-upload-progress'
  | 'common-upload-success'
  | 'common-upload-failed'
  | 'change'
  | 'group-created';

test('EventMap has exactly the documented events', () => {
  expectTypeOf<keyof EventMap>().toEqualTypeOf<DocumentedEvent>();
});

// The 15 methods documented in `api.mdx`.
type DocumentedMethod =
  | 'getOutputItem'
  | 'getOutputCollectionState'
  | 'uploadAll'
  | 'addFileFromObject'
  | 'addFileFromUuid'
  | 'addFileFromUrl'
  | 'addFileFromCdnUrl'
  | 'removeFileByInternalId'
  | 'removeAllFiles'
  | 'initFlow'
  | 'doneFlow'
  | 'setCurrentActivity'
  | 'historyBack'
  | 'setModalState'
  | 'on';

test('the api exposes every documented method', () => {
  expectTypeOf<DocumentedMethod>().toExtend<keyof ReturnType<UploadCtxProvider['getAPI']>>();
});
