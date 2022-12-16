import { ActivityBlock } from '../../abstract/ActivityBlock.js';

export class ActivityHeader extends ActivityBlock {}

ActivityHeader.template = /* HTML */ `
  <div class="header-content">
    <button type="button" class="mini-btn close-btn" set="onclick: closeClicked">
      <lr-icon name="close"></lr-icon>
    </button>
    <div class="caption">
      <lr-icon set="@name: *activityIcon; @hidden: !*activityIcon"></lr-icon>
      <div>{{*activityCaption}}</div>
    </div>
    <button type="button" class="mini-btn close-btn" set="onclick: closeClicked">
      <lr-icon name="close"></lr-icon>
    </button>
  </div>
`;
