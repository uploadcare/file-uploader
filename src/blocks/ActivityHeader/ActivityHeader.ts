import { ActivityChildBlock } from '../../lit/ActivityChildBlock';
import './activity-header.css';

export class ActivityHeader extends ActivityChildBlock {}

declare global {
  interface HTMLElementTagNameMap {
    'uc-activity-header': ActivityHeader;
  }
}
