import { ActivityBlock } from '../../abstract/ActivityBlock.js';

export class ActivityIcon extends ActivityBlock {}

ActivityIcon.template = /* HTML */ `<lr-icon set="@name: *activityIcon; @hidden: !*activityIcon"></lr-icon>`;
