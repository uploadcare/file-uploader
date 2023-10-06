import { getDropItems } from './getDropItems.js';

/** @enum {Number} */
export const DropzoneState = {
  ACTIVE: 0,
  INACTIVE: 1,
  NEAR: 2,
  OVER: 3,
};

let RESET_EVENTS = ['focus'];
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
 * @param {() => Boolean} desc.shouldIgnore
 */
export function addDropzone(desc) {
  let eventCounter = 0;

  let body = document.body;
  let switchHandlers = new Set();
  let handleSwitch = (fn) => switchHandlers.add(fn);
  let state = DropzoneState.INACTIVE;

  let setState = (newState) => {
    if (desc.shouldIgnore() && newState !== DropzoneState.INACTIVE) {
      return;
    }
    if (state !== newState) {
      switchHandlers.forEach((fn) => fn(newState));
    }
    state = newState;
  };

  let isDragging = () => eventCounter > 0;

  handleSwitch((newState) => desc.onChange(newState));

  let onResetEvent = () => {
    eventCounter = 0;
    setState(DropzoneState.INACTIVE);
  };
  let onDragEnter = () => {
    eventCounter += 1;
    if (state === DropzoneState.INACTIVE) {
      setState(DropzoneState.ACTIVE);
    }
  };
  let onDragLeave = () => {
    eventCounter -= 1;
    if (!isDragging()) {
      setState(DropzoneState.INACTIVE);
    }
  };
  let onDrop = (e) => {
    e.preventDefault();
    eventCounter = 0;
    setState(DropzoneState.INACTIVE);
  };

  let onDragOver = (e) => {
    if (desc.shouldIgnore()) {
      return;
    }

    if (!isDragging()) {
      eventCounter += 1;
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
      e.preventDefault();
      setState(DropzoneState.OVER);
    } else if (isNear && isNearest) {
      setState(DropzoneState.NEAR);
    } else {
      setState(DropzoneState.ACTIVE);
    }
  };

  let onElementDrop = async (e) => {
    if (desc.shouldIgnore()) {
      return;
    }
    e.preventDefault();
    let items = await getDropItems(e.dataTransfer);
    desc.onItems(items);
    setState(DropzoneState.INACTIVE);
  };

  body.addEventListener('drop', onDrop);
  body.addEventListener('dragleave', onDragLeave);
  body.addEventListener('dragenter', onDragEnter);
  body.addEventListener('dragover', onDragOver);
  desc.element.addEventListener('drop', onElementDrop);
  RESET_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, onResetEvent);
  });

  return () => {
    nearnessRegistry.delete(desc.element);
    body.removeEventListener('drop', onDrop);
    body.removeEventListener('dragleave', onDragLeave);
    body.removeEventListener('dragenter', onDragEnter);
    body.removeEventListener('dragover', onDragOver);
    desc.element.removeEventListener('drop', onElementDrop);
    RESET_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, onResetEvent);
    });
  };
}
