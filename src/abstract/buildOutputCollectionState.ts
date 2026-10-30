import type {
  GroupFlag,
  OutputCollectionState,
  OutputCollectionStatus,
  OutputErrorCollection,
  OutputFileEntry,
} from '../types/index';
import { partitionByStatus } from './collectionSummary';
import { CollectionStateController } from './controllers/CollectionStateController';
import { UploadCollectionController } from './controllers/UploadCollectionController';
import type { ControllerContainer } from './di/ControllerContainer';
import { logger } from './logger';
import { outputEntries } from './outputFileEntry';

const log = logger.scope('output-collection-state');

const KEEP_A_COPY =
  'Read it synchronously, or keep a copy in the handler with `state.snapshot()` or the spread operator ' +
  '(`{...e.detail}`).';

const LATE_READ_WARNING =
  "You've read an OutputCollectionState's file entries after the task that created it, so they are newer than " +
  `the state or the event that carried it. ${KEEP_A_COPY}`;

const READ_AFTER_DESTROY_ERROR =
  "An OutputCollectionState's file entries were read after its uploader was destroyed, so there is nothing left to " +
  `read them from. ${KEEP_A_COPY}`;

const mixedReadWarning = (fields: readonly string[]): string =>
  `You've read an OutputCollectionState whose ${fields.map((f) => `\`${f}\``).join(', ')} changed between the ` +
  `event and your read of its file entries, so the values you combined describe two different states. ${KEEP_A_COPY}`;

// The task a state was built in. One shared timer per task advances it, not one per state: every event payload is a
// state, and most are never read.
let currentTask = 0;
let taskEndScheduled = false;
const taskNow = (): number => {
  if (!taskEndScheduled) {
    taskEndScheduled = true;
    setTimeout(() => {
      currentTask += 1;
      taskEndScheduled = false;
    }, 0);
  }
  return currentTask;
};

/** Forgets a pending task end, which a test that swaps timer implementations would otherwise strand. */
export const __resetTaskClockForTests = (): void => {
  taskEndScheduled = false;
};

// `snapshot` is non-enumerable, so a spread copy is plain data that `structuredClone` and `postMessage` accept. Each
// copy gets its own `snapshot`, so calling it on a copy copies again.
function snapshot<T extends object>(this: T): T {
  return withSnapshot({ ...this });
}

function withSnapshot<T extends object>(state: T): T {
  return Object.defineProperty(state, 'snapshot', { value: snapshot });
}

/** Cheap to read, so they are read when the state is built. */
const BUILD_TIME_FIELDS = [
  'progress',
  'errors',
  'group',
  'totalCount',
] as const satisfies readonly (keyof OutputCollectionState)[];

/** Derived from the output entries, so they are computed together on the first read of any of them. */
const ENTRY_FIELDS = [
  'failedCount',
  'successCount',
  'uploadingCount',
  'status',
  'isSuccess',
  'isUploading',
  'isFailed',
  'allEntries',
  'successEntries',
  'failedEntries',
  'uploadingEntries',
  'idleEntries',
] as const satisfies readonly (keyof OutputCollectionState)[];

/** Each field of the state on its own: the union of what it can hold across every status. */
type Fields<K extends keyof OutputCollectionState> = { [P in K]: OutputCollectionState[P] };
type BuildTimeField = (typeof BUILD_TIME_FIELDS)[number];

const readBuildTimeFields = (container: ControllerContainer): Fields<BuildTimeField> => {
  // `CollectionStateController` owns progress, collection errors and the group.
  const collectionState = container.get(CollectionStateController);
  return {
    progress: collectionState.get('commonProgress'),
    errors: collectionState.get('collectionErrors'),
    group: collectionState.get('groupInfo'),
    totalCount: container.get(UploadCollectionController).size,
  };
};

// Validation writes a fresh `errors` array on every run, so errors compare by what they say.
const sameErrors = (a: readonly OutputErrorCollection[], b: readonly OutputErrorCollection[]): boolean =>
  a.length === b.length && a.every((error, i) => error.type === b[i]?.type && error.message === b[i]?.message);

const changedFields = (before: Fields<BuildTimeField>, now: Fields<BuildTimeField>): Set<BuildTimeField> => {
  const changed = new Set<BuildTimeField>();
  if (before.progress !== now.progress) changed.add('progress');
  if (!sameErrors(before.errors, now.errors)) changed.add('errors');
  if (before.group !== now.group) changed.add('group');
  if (before.totalCount !== now.totalCount) changed.add('totalCount');
  return changed;
};

export function buildOutputCollectionState<
  TCollectionStatus extends OutputCollectionStatus,
  TGroupFlag extends GroupFlag = 'maybe-has-group',
>(container: ControllerContainer): OutputCollectionState<TCollectionStatus, TGroupFlag> {
  // Two moments, never one per field. The cheap fields are read now. The entry-derived ones are built together on
  // the first read of any of them, so a payload whose handler reads only `progress` builds no `OutputFileEntry`.
  // Read synchronously, as documented, both moments are the same one. When they are not, a reader that combines a
  // build-time field that has changed with the entries gets warned.
  const atBuild = readBuildTimeFields(container);
  const builtInTask = taskNow();

  const takeEntries = (): Fields<(typeof ENTRY_FIELDS)[number]> => {
    const allEntries = outputEntries(container);
    const { errors } = atBuild;

    const buckets = partitionByStatus(allEntries, (entry) => entry.status);
    // `partitionByStatus` sorts by the status each entry carries, which is what narrows its type.
    const successEntries = buckets.success as OutputFileEntry<'success'>[];
    const failedEntries = buckets.failed as OutputFileEntry<'failed'>[];
    const uploadingEntries = buckets.uploading as OutputFileEntry<'uploading'>[];
    const idleEntries = buckets.idle as OutputFileEntry<'idle'>[];

    const isFailed = errors.length > 0 || failedEntries.length > 0;
    const isUploading = uploadingEntries.length > 0;
    const isSuccess = allEntries.length > 0 && errors.length === 0 && successEntries.length === allEntries.length;
    const status = isFailed ? 'failed' : isUploading ? 'uploading' : isSuccess ? 'success' : 'idle';

    return {
      failedCount: failedEntries.length,
      successCount: successEntries.length,
      uploadingCount: uploadingEntries.length,
      status,
      isSuccess,
      isUploading,
      isFailed,
      allEntries,
      successEntries,
      failedEntries,
      uploadingEntries,
      idleEntries,
    };
  };

  let entries: ReturnType<typeof takeEntries> | undefined;
  // Build-time fields that had changed by the time the entries were taken, and those the reader has seen.
  let changedBeforeEntries: Set<BuildTimeField> | undefined;
  const readBuildTime = new Set<BuildTimeField>();
  const warnIfMixed = (fields: BuildTimeField[]) => {
    if (fields.length > 0) log.warnOnce(mixedReadWarning(fields));
  };

  // The status-narrowed type is the caller's promise (`getOutputCollectionState<'success'>()`); the getters below
  // are what fill it.
  const state = {} as OutputCollectionState<TCollectionStatus, TGroupFlag>;
  for (const key of BUILD_TIME_FIELDS) {
    Object.defineProperty(state, key, {
      get: () => {
        readBuildTime.add(key);
        if (changedBeforeEntries?.has(key)) warnIfMixed([key]);
        return atBuild[key];
      },
      enumerable: true,
    });
  }
  for (const key of ENTRY_FIELDS) {
    Object.defineProperty(state, key, {
      get: () => {
        if (!entries) {
          if (container.disposed) throw new Error(`[uc] ${READ_AFTER_DESTROY_ERROR}`);
          if (taskNow() !== builtInTask) log.warnOnce(LATE_READ_WARNING);
          entries = takeEntries();
          changedBeforeEntries = changedFields(atBuild, readBuildTimeFields(container));
          warnIfMixed([...changedBeforeEntries].filter((field) => readBuildTime.has(field)));
        }
        return entries[key];
      },
      enumerable: true,
    });
  }
  return withSnapshot(state);
}
