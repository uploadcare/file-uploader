import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDropzone } from './addDropzone';
import { getDropItems } from './getDropItems';

vi.mock('./getDropItems', () => ({ getDropItems: vi.fn() }));

const dropOn = (element: HTMLElement) => {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: {} });
  element.dispatchEvent(event);
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('addDropzone', () => {
  it('hands the dropped items over', async () => {
    vi.mocked(getDropItems).mockResolvedValue([{ type: 'url', url: 'https://example.com/a.jpg' }]);
    const element = document.body.appendChild(document.createElement('div'));
    const onItems = vi.fn();
    const destroy = addDropzone({ element, shouldIgnore: () => false, onChange: () => {}, onItems });

    dropOn(element);

    await vi.waitFor(() => expect(onItems).toHaveBeenCalledWith([{ type: 'url', url: 'https://example.com/a.jpg' }]));
    destroy();
  });

  it('drops the items of a drop that finishes reading after the zone was torn down', async () => {
    let resolve!: (items: Awaited<ReturnType<typeof getDropItems>>) => void;
    vi.mocked(getDropItems).mockReturnValue(
      new Promise((res) => {
        resolve = res;
      }),
    );
    const element = document.body.appendChild(document.createElement('div'));
    const onItems = vi.fn();
    const destroy = addDropzone({ element, shouldIgnore: () => false, onChange: () => {}, onItems });

    dropOn(element);
    destroy();
    resolve([{ type: 'url', url: 'https://example.com/a.jpg' }]);
    await new Promise((res) => setTimeout(res, 0));

    expect(onItems).not.toHaveBeenCalled();
  });
});
