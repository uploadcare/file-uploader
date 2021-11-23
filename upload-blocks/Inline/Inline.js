import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class Inline extends BlockComponent {
  initCallback() {
    this.sub('*uploadList', (list) => {
      if (!list.length) {
        this.set$({
          '*currentActivity': BlockComponent.activities.SOURCE_SELECT,
        });
      }
    });

    this.sub('*currentActivity', (currentActivity) => {
      if (!currentActivity) {
        this.set$({
          '*currentActivity': BlockComponent.activities.SOURCE_SELECT,
        });
      }
    });
  }
}

Inline.template = /*html*/ `
<slot></slot>
`;
