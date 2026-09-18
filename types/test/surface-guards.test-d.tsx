import '../jsx';
import type { LitElement } from 'lit';
import { expectAssignable, expectType } from 'tsd';
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

// Every registered block can be written in JSX.
declare const notInJsx: Exclude<BlockTag, keyof JSX.IntrinsicElements>;
expectType<never>(notInJsx);

// ...and is known to `document.createElement` / `querySelector`.
declare const notInTagNameMap: Exclude<BlockTag, keyof HTMLElementTagNameMap>;
expectType<never>(notInTagNameMap);

// The 18 events documented in fern-docs `events.mdx` (specs/public-api/public-surface.json), and no others.
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
declare const eventKey: keyof EventMap;
expectType<DocumentedEvent>(eventKey);

// The 15 methods documented in `api.mdx` exist on the api object with those names.
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
declare const method: DocumentedMethod;
expectAssignable<keyof ReturnType<UploadCtxProvider['getAPI']>>(method);
