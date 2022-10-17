import { getDropItems } from './getDropItems.js';

/** @enum {Number} */
export const DropzoneState = {
  ACTIVE: 0,
  INACTIVE: 1,
  NEAR: 2,
  OVER: 3,
};

let FINAL_EVENTS = ['dragleave', 'dragexit', 'dragend', 'drop', 'mouseleave', 'mouseout'];
let NEAR_OFFSET = 100;
let nearnessRegistry = new Map();

/**
 * @param {[x: number, y: number]} p
 * @param {{ x: number; y: number; width: number; height: number }} r
 * @returns {number}
 */
function distance(p, r) {
  let cx = Math.max(Math.min(p[0], r.x + r.width), r.x);
  let cy = Math.max(Math.min(p[1], r.y + r.height), r.y);

  return Math.sqrt((p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy));
}

/**
 * @param {Object} desc
 * @param {HTMLElement} desc.element
 * @param {Function} desc.onChange
 * @param {Function} desc.onItems
 */
export function addDropzone(desc) {
  let switchHandlers = new Set();
  let handleSwitch = (fn) => switchHandlers.add(fn);
  let state = DropzoneState.INACTIVE;

  let setState = (newState) => {
    if (state !== newState) {
      switchHandlers.forEach((fn) => fn(newState));
    }
    state = newState;
  };

  let onFinalEvent = (e) => {
    let { clientX, clientY } = e;
    let bodyBounds = document.body.getBoundingClientRect();
    let isDrop = e.type === 'drop';
    let isOuterDrag = ['dragleave', 'dragexit', 'dragend'].includes(e.type) && clientX === 0 && clientY === 0;
    let isOuterMouse =
      ['mouseleave', 'mouseout'].includes(e.type) &&
      (clientX < 0 || clientX > bodyBounds.width || clientY < 0 || clientY > bodyBounds.height);
    if (isDrop || isOuterDrag || isOuterMouse) {
      setState(DropzoneState.INACTIVE);
    }
    e.preventDefault();
  };

  handleSwitch((newState) => desc.onChange(newState));
  handleSwitch((newState) => {
    if (newState === DropzoneState.ACTIVE) {
      FINAL_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, onFinalEvent, false);
      });
    }
  });
  handleSwitch((newState) => {
    if (newState === DropzoneState.INACTIVE) {
      FINAL_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, onFinalEvent, false);
      });
    }
  });

  let onDragOver = (e) => {
    // console.log(e)
    // Not sure that it won't conflict with other dnd elements on the page
    e.preventDefault();
    if (state === DropzoneState.INACTIVE) {
      setState(DropzoneState.ACTIVE);
    }

    /** @type {[Number, Number]} */
    let dragPoint = [e.x, e.y];
    let targetRect = desc.element.getBoundingClientRect();
    let nearness = Math.floor(distance(dragPoint, targetRect));
    let isNear = nearness < NEAR_OFFSET;
    let isOver = e.composedPath().includes(desc.element);

    nearnessRegistry.set(desc.element, nearness);
    let isNearest = Math.min(...nearnessRegistry.values()) === nearness;

    if (isOver && isNearest) {
      setState(DropzoneState.OVER);
    } else if (isNear && isNearest) {
      setState(DropzoneState.NEAR);
    } else {
      setState(DropzoneState.ACTIVE);
    }
  };
  window.addEventListener('dragover', onDragOver, false);

  let onDrop = async (e) => {
    e.preventDefault();
    let items = await getDropItems(e.dataTransfer);
    desc.onItems(items);
    setState(DropzoneState.INACTIVE);
  };
  desc.element.addEventListener('drop', onDrop);

  return () => {
    nearnessRegistry.delete(desc.element);
    window.removeEventListener('dragover', onDragOver, false);
    desc.element.removeEventListener('drop', onDrop);
    FINAL_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, onFinalEvent, false);
    });
  };
}
