import { page } from '@vitest/browser/context';
import { CommonDOMRenderer } from 'render-jsx/dom';
import { beforeEach } from 'vitest';

export const renderer = new CommonDOMRenderer();

const containers = new Set<HTMLElement>();

export const render = (jsx: any) => {
  const container = document.createElement('div');
  containers.add(container);
  renderer.render(jsx).on(container);
  document.body.appendChild(container);
};

export const cleanup = () => {
  containers.forEach((container) => {
    container.remove();
  });
  containers.clear();
};

page.extend({
  render,
  [Symbol.for('vitest:component-cleanup')]: cleanup,
});

beforeEach(async () => {
  cleanup();
});

declare module '@vitest/browser/context' {
  interface BrowserPage {
    render: typeof render;
  }
}
