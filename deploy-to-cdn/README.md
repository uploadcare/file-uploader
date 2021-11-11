# Deploy libs to Uploadcare CDN

```js
import { deployToCdn } from './deploy-to-cdn.js';
import { resolve } from 'path';

deployToCdn({ name: 'my-package', version: '3.1.2-alpha.0.2', input: resolve('./dist'), dry: true });
```
