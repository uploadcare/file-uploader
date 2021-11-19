import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class Inline extends BlockComponent {
  initCallback() {
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
