import './index.css';

export * from '../../blocks/CloudImageEditor/index';
export * from './CloudImageEditor';

/* TODO: We need to make some dependency injection/checking magic
I see it as a declared list of tags on which the block depends
Then we can check whether the dependent tag is registered in the CustomElementRegistry or not.
If not, register it from default ones or just log the warning */

export { defineComponents } from '../../abstract/defineComponents';
// `Config` (uc-config) stays for backward compatibility — the standalone editor
// composition still relies on a sibling `<uc-config>`. `Icon` (uc-icon) is NOT
// exported: the editor renders `uc-editor-icon`, so shipping the ChildBlock-based
// `uc-icon` from this bundle was vestigial.
export { Config } from '../../blocks/Config/Config';
