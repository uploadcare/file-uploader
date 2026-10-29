import { getDropItems } from './getDropItems';

/** The drag state, written as is to the drop area's `drag-state` attribute. */
export type DropzoneState = 'active' | 'inactive' | 'near' | 'over';

type DropItems = Awaited<ReturnType<typeof getDropItems>>;

type DropzoneDescriptor = {
  element: HTMLElement;
  onChange: (state: DropzoneState) => void;
  onItems: (items: DropItems) => void;
  shouldIgnore: () => boolean;
};

const RESET_EVENTS: Array<keyof WindowEventMap> = ['focus'];
const NEAR_OFFSET = 100;
const nearnessRegistry = new Map<HTMLElement, number>();

function distance(point: [number, number], rect: DOMRect): number {
  const cx = Math.max(Math.min(point[0], rect.x + rect.width), rect.x);
  const cy = Math.max(Math.min(point[1], rect.y + rect.height), rect.y);

  return Math.sqrt((point[0] - cx) * (point[0] - cx) + (point[1] - cy) * (point[1] - cy));
}

export function addDropzone(desc: DropzoneDescriptor): () => void {
  let eventCounter = 0;
  // Aborted by the returned teardown: removes every listener, and tells a drop still reading its items to drop them.
  const listeners = new AbortController();
  const { signal } = listeners;

  const body = document.body;
  let state: DropzoneState = 'inactive';

  const setState = (newState: DropzoneState) => {
    if (desc.shouldIgnore() && newState !== 'inactive') {
      return;
    }
    if (state !== newState) {
      desc.onChange(newState);
    }
    state = newState;
  };

  const isDragging = () => eventCounter > 0;

  const onResetEvent = () => {
    eventCounter = 0;
    setState('inactive');
  };
  const onDragEnter = () => {
    eventCounter += 1;
    if (state === 'inactive') {
      setState('active');
    }
  };
  const onDragLeave = () => {
    eventCounter -= 1;
    if (!isDragging()) {
      setState('inactive');
    }
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    eventCounter = 0;
    setState('inactive');
  };

  const onDragOver = (event: DragEvent) => {
    if (desc.shouldIgnore()) {
      return;
    }

    if (!isDragging()) {
      eventCounter += 1;
    }

    const dragPoint: [number, number] = [event.x, event.y];
    const targetRect = desc.element.getBoundingClientRect();
    const nearness = Math.floor(distance(dragPoint, targetRect));
    const isNear = nearness < NEAR_OFFSET;
    const isOver = event.composedPath().includes(desc.element);

    nearnessRegistry.set(desc.element, nearness);
    const minNearness = Math.min(...nearnessRegistry.values());
    const isNearest = minNearness === nearness;

    if (isOver && isNearest) {
      event.preventDefault();
      setState('over');
    } else if (isNear && isNearest) {
      setState('near');
    } else {
      setState('active');
    }
  };

  const onElementDrop = async (event: DragEvent) => {
    if (desc.shouldIgnore()) {
      return;
    }
    event.preventDefault();
    const { dataTransfer } = event;
    if (!dataTransfer) {
      return;
    }
    const items = await getDropItems(dataTransfer);
    if (signal.aborted) {
      return;
    }
    desc.onItems(items);
    setState('inactive');
  };

  body.addEventListener('drop', onDrop, { signal });
  body.addEventListener('dragleave', onDragLeave, { signal });
  body.addEventListener('dragenter', onDragEnter, { signal });
  body.addEventListener('dragover', onDragOver, { signal });
  desc.element.addEventListener('drop', onElementDrop, { signal });
  RESET_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, onResetEvent, { signal });
  });

  return () => {
    nearnessRegistry.delete(desc.element);
    listeners.abort();
  };
}
