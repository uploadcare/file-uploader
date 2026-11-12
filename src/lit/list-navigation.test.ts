import { describe, expect, it } from 'vitest';
import { survivingNeighbour, targetRowIndex } from './list-navigation';

describe('targetRowIndex', () => {
  const list = (key: string, from: number) => targetRowIndex(key, from, 300, 1, 10);
  const grid = (key: string, from: number) => targetRowIndex(key, from, 10, 3, 2);

  it('moves a list by one row, a page, or to its ends', () => {
    expect(list('ArrowDown', 5)).toBe(6);
    expect(list('ArrowUp', 5)).toBe(4);
    expect(list('Home', 150)).toBe(0);
    expect(list('End', 0)).toBe(299);
    expect(list('PageDown', 5)).toBe(15);
    expect(list('PageUp', 15)).toBe(5);
  });

  it('stops at the ends', () => {
    expect(list('ArrowDown', 299)).toBe(299);
    expect(list('ArrowUp', 0)).toBe(0);
    expect(list('PageDown', 295)).toBe(299);
    expect(list('PageUp', 4)).toBe(0);
  });

  it('pages by at least one row', () => {
    expect(targetRowIndex('PageDown', 0, 300, 1, 0)).toBe(1);
  });

  it('leaves ArrowLeft/Right and other keys to the browser in a list', () => {
    expect(list('ArrowRight', 5)).toBeNull();
    expect(list('ArrowLeft', 5)).toBeNull();
    expect(list('Enter', 5)).toBeNull();
    expect(list('a', 5)).toBeNull();
  });

  it('moves a grid by one cell sideways and one visual row up and down', () => {
    // 3 columns: 0 1 2 / 3 4 5 / 6 7 8 / 9
    expect(grid('ArrowRight', 4)).toBe(5);
    expect(grid('ArrowLeft', 4)).toBe(3);
    expect(grid('ArrowDown', 1)).toBe(4);
    expect(grid('ArrowUp', 4)).toBe(1);
    expect(grid('ArrowUp', 2)).toBe(2);
    expect(grid('PageDown', 1)).toBe(7);
    expect(grid('PageUp', 8)).toBe(2);
    expect(grid('ArrowRight', 9)).toBe(9);
    expect(grid('ArrowLeft', 0)).toBe(0);
  });

  it('moves to the next cell with ArrowLeft in a right-to-left grid', () => {
    expect(targetRowIndex('ArrowLeft', 4, 10, 3, 2, true)).toBe(5);
    expect(targetRowIndex('ArrowRight', 4, 10, 3, 2, true)).toBe(3);
    expect(targetRowIndex('ArrowRight', 4, 300, 1, 10, true)).toBeNull();
  });

  it('drops to the last cell from the row above a short last row, and stays on the last row', () => {
    expect(grid('ArrowDown', 7)).toBe(9);
    expect(grid('ArrowDown', 6)).toBe(9);
    expect(grid('ArrowDown', 9)).toBe(9);
  });
});

describe('survivingNeighbour', () => {
  it('takes the next row, else the previous one, else none', () => {
    expect(survivingNeighbour(['a', 'b', 'c'], ['a', 'c'], 'b')).toBe('c');
    expect(survivingNeighbour(['a', 'b', 'c'], ['a', 'b'], 'c')).toBe('b');
    expect(survivingNeighbour(['a', 'b', 'c'], ['a'], 'b')).toBe('a');
    expect(survivingNeighbour(['a', 'b'], [], 'a')).toBeNull();
  });

  it('skips the rows removed with it', () => {
    expect(survivingNeighbour(['a', 'b', 'c', 'd'], ['a', 'd'], 'b')).toBe('d');
  });
});
