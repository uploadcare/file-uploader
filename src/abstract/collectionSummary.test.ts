import { describe, expect, it } from 'vitest';
import { type CollectionSummary, collectionHeader, partitionByStatus } from './collectionSummary';

const summary = (counts: Partial<CollectionSummary>): CollectionSummary => ({
  total: 0,
  success: 0,
  uploading: 0,
  failed: 0,
  validatingBeforeUploading: 0,
  ...counts,
});

describe('collectionHeader', () => {
  it('puts work in flight first, counting validation as uploading', () => {
    expect(collectionHeader(summary({ total: 3, uploading: 1, validatingBeforeUploading: 1, failed: 1 }))).toEqual({
      key: 'header-uploading',
      count: 2,
    });
  });

  it('then failures, then finished uploads, then the total', () => {
    expect(collectionHeader(summary({ total: 2, failed: 1, success: 1 }))).toEqual({ key: 'header-failed', count: 1 });
    expect(collectionHeader(summary({ total: 2, success: 1 }))).toEqual({ key: 'header-succeed', count: 1 });
    expect(collectionHeader(summary({ total: 2 }))).toEqual({ key: 'header-total', count: 2 });
  });
});

describe('partitionByStatus', () => {
  it('keeps the order within a bucket and drops removed items', () => {
    const items = ['s1', 'r', 'f', 's2', 'u', 'i'];
    const status = { s1: 'success', s2: 'success', r: 'removed', f: 'failed', u: 'uploading', i: 'idle' } as const;

    expect(partitionByStatus(items, (item) => status[item as keyof typeof status])).toEqual({
      success: ['s1', 's2'],
      failed: ['f'],
      uploading: ['u'],
      idle: ['i'],
    });
  });
});
