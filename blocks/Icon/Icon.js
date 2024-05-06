// @ts-check
import { Block } from '../../abstract/Block.js';

export class Icon extends Block {
  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      name: '',
      href: '',
      title: '',
    };
  }

  initCallback() {
    super.initCallback();
    this.sub('name', (val) => {
      if (!val) {
        return;
      }
      let iconHref = `#uc-icon-${val}`;
      if (this.cfg.iconHrefResolver) {
        const customIconHref = this.cfg.iconHrefResolver(val);
        iconHref = customIconHref ?? iconHref;
      }
      this.$.href = iconHref;
    });
  }
}

Icon.template = /* HTML */ `
  <svg ref="svg" xmlns="http://www.w3.org/2000/svg">
    <title>{{title}}</title>
    <use set="@href: href;"></use>
  </svg>
`;

Icon.bindAttributes({
  name: 'name',
  title: 'title',
});
