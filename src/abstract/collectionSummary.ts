import type { OutputFileStatus } from '../types/exported';

/** How far along a collection is, counted per entry status. */
export type CollectionSummary = {
  total: number;
  success: number;
  uploading: number;
  failed: number;
  /** Idle entries still being validated before they upload. */
  validatingBeforeUploading: number;
};

/**
 * How often the upload list and the dynamic button recount the collection. They share it so the two never show
 * different counts for long.
 */
export const COLLECTION_SUMMARY_THROTTLE_MS = 300;

export type CollectionHeaderKey = 'header-uploading' | 'header-failed' | 'header-succeed' | 'header-total';

/**
 * The header line for a collection. Work in flight comes first (validating counts as uploading), then failures, then
 * finished uploads, then the plain total.
 */
export function collectionHeader(summary: CollectionSummary): { key: CollectionHeaderKey; count: number } {
  const inFlight = summary.uploading + summary.validatingBeforeUploading;
  if (inFlight > 0) return { key: 'header-uploading', count: inFlight };
  if (summary.failed > 0) return { key: 'header-failed', count: summary.failed };
  if (summary.success > 0) return { key: 'header-succeed', count: summary.success };
  return { key: 'header-total', count: summary.total };
}

/** Sorts items into one bucket per status, in order. A removed item lands in none. */
export function partitionByStatus<T>(
  items: Iterable<T>,
  statusOf: (item: T) => OutputFileStatus,
): Record<Exclude<OutputFileStatus, 'removed'>, T[]> {
  const buckets: Record<Exclude<OutputFileStatus, 'removed'>, T[]> = {
    success: [],
    failed: [],
    uploading: [],
    idle: [],
  };
  for (const item of items) {
    const status = statusOf(item);
    if (status !== 'removed') buckets[status].push(item);
  }
  return buckets;
}
