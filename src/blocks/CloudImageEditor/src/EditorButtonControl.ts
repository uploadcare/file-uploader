import { Block } from '../../../abstract/Block';
import { classNames } from './lib/classNames.js';

interface EditorButtonControlInitState {
  active: boolean;
  title: string;
  icon: string;
  'on.click': ((event: MouseEvent) => unknown) | null;
  'title-prop': string;
}

export class EditorButtonControl extends Block {
  private _titleEl?: HTMLElement;

  constructor() {
    super();
    this.init$ = {
      ...this.init$,
      active: false,
      title: '',
      icon: '',
      'on.click': null,
      'title-prop': '',
    } as EditorButtonControlInitState;
  }

  override initCallback(): void {
    super.initCallback();

    this._titleEl = this.ref['title-el'] as HTMLElement | undefined;
    this.sub('title', (title: string) => {
      const titleEl = this._titleEl;
      if (titleEl) {
        titleEl.style.display = title ? 'block' : 'none';
      }
    });

    this.sub('active', (active: boolean) => {
      this.className = classNames({
        'uc-active': active,
        'uc-not_active': !active,
      });
    });

    this.sub('on.click', (onClick: ((event: MouseEvent) => unknown) | null) => {
      this.onclick = onClick ?? null;
    });
  }
}

EditorButtonControl.template = /* HTML */ `
  <button role="option" type="button" set="@aria-label:title-prop;" l10n="@title:title-prop;">
    <uc-icon ref="icon-el" set="@name: icon;"></uc-icon>
    <div class="uc-title" ref="title-el">{{title}}</div>
  </button>
`;
