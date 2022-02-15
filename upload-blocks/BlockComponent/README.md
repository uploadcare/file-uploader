# BlockComponent

```js
import BlockComponent from './BlockComponent.js';

class MyCustomUploadBlock extends BlockComponent {
  init$ = {
    someProp: 'some value',
  }
}

MyCustomUploadBlock.template = /*html*/ `
  <div>{{someProp}}</div>
`;
```