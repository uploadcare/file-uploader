import './index.css';

export * from '../../blocks/CloudImageEditor/index';
export * from './CloudImageEditor';
export * from './CloudImageEditorPlugin';

/* TODO: We need to make some dependency injection/checking magic
I see it as a declared list of tags on which the block depends
Then we can check whether the dependent tag is registered in the CustomElementRegistry or not.
If not, register it from default ones or just log the warning */

export { defineComponents } from '../../abstract/defineComponents';
export { Config } from '../../blocks/Config/Config';
export { Icon } from '../../blocks/Icon/Icon';
