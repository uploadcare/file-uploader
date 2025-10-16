import './icon.css';
import { Block } from '../../abstract/Block';
import type { IconHrefResolver } from '../../types/index';

export class Icon extends Block {
  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      name: '',
      href: '',
    };
  }

  override initCallback(): void {
    super.initCallback();
    this.sub('name', (val: string) => {
      if (!val) {
        return;
      }
      let iconHref = `#uc-icon-${val}`;
      this.subConfigValue('iconHrefResolver', (iconHrefResolver: IconHrefResolver | null) => {
        if (iconHrefResolver) {
          const customIconHref = iconHrefResolver(val);
          iconHref = customIconHref ?? iconHref;
        }
        this.$.href = iconHref;
      });
    });

    this.setAttribute('aria-hidden', 'true');
  }
}

Icon.template = /* HTML */ `
  <svg ref="svg" xmlns="http://www.w3.org/2000/svg">
    <use set="@href: href;"></use>
  </svg>
`;

Icon.bindAttributes({
  name: 'name',
});
