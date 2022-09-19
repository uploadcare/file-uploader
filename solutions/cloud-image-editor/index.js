import * as CloudEditorBlocks from './CloudEditor.js';

/* TODO: We need to make some dependency injection/checking magic
I see it as a declared list of tags on which the block depends
Then we can check whether the dependent tag is registered in the CustomElementRegistry or not.
If not, register it from default ones or just log the warning */

import { Icon } from '../../blocks/Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ ...CloudEditorBlocks, Icon });
