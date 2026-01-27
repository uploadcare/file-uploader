import { LitActivityBlock } from '../../lit/LitActivityBlock';
import './activity-header.css';

export class ActivityHeader extends LitActivityBlock {}

declare global {
  interface HTMLElementTagNameMap {
    'uc-activity-header': ActivityHeader;
  }
}
