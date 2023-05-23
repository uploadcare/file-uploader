import { Block } from '../../abstract/Block.js';

export class Icon extends Block {
  init$ = {
    ...this.init$,
    name: '',
    path: '',
    size: '24',
    viewBox: '',
  };

  initCallback() {
    super.initCallback();
    this.sub('name', (val) => {
      if (!val) {
        return;
      }
      let path = this.getCssData(`--icon-${val}`);
      if (path) {
        this.$.path = path;
      }
    });

    this.sub('path', (path) => {
      if (!path) {
        return;
      }
      let isRaw = path.trimStart().startsWith('<');
      if (isRaw) {
        this.setAttribute('raw', '');
        this.ref.svg.innerHTML = path;
      } else {
        this.removeAttribute('raw');
        this.ref.svg.innerHTML = `<path fill-rule="evenodd" d="${path}"></path>`;
      }
    });

    this.sub('size', (size) => {
      this.$.viewBox = `0 0 ${size} ${size}`;
    });
  }
}

Icon.template = /* HTML */ `
  <svg ref="svg" xmlns="http://www.w3.org/2000/svg" set="@viewBox: viewBox; @height: size; @width: size"></svg>
`;

Icon.bindAttributes({
  name: 'name',
  size: 'size',
});
