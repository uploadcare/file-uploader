import { CommonDOMRenderer} from 'render-jsx/dom';

export const renderer = new CommonDOMRenderer();

export const render = (jsx: any) => {
  renderer.render(jsx).on(document.body);
};
