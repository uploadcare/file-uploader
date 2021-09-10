export const buttonsModel = [
  {
    action: 'fullscreen',
    icon: '',
    l10n_name: 'toggle-fullscreen',
    loc: '@name: fsIcon',
  },
  // {
  //   action: 'guides',
  //   icon: 'edit-guides',
  //   l10n_name: 'toggle-guides',
  //   loc: '',
  // },
  {
    action: 'rotate_cw',
    icon: 'edit-rotate',
    l10n_name: 'rotate',
    loc: '',
  },
  {
    action: 'flip_v',
    icon: 'edit-flip-v',
    l10n_name: 'flip-vertical',
    loc: '',
  },
  {
    action: 'flip_h',
    icon: 'edit-flip-h',
    l10n_name: 'flip-horizontal',
    loc: '',
  },
  {
    action: 'brightness',
    icon: 'edit-brightness',
    l10n_name: 'brightness',
    loc: '',
  },
  {
    action: 'contrast',
    icon: 'edit-contrast',
    l10n_name: 'contrast',
    loc: '',
  },
  {
    action: 'saturation',
    icon: 'edit-saturation',
    l10n_name: 'saturation',
    loc: '',
  },
  // {
  //   action: 'resize',
  //   icon: 'edit-resize',
  //   l10n_name: 'resize',
  //   loc: '',
  // },
  // {
  //   action: 'crop',
  //   icon: 'edit-crop',
  //   l10n_name: 'crop',
  //   loc: '',
  // },
  {
    action: 'color',
    icon: 'edit-color',
    l10n_name: 'select-color',
    loc: '',
    ref: 'color_btn',
  },
  {
    action: 'text',
    icon: 'edit-text',
    l10n_name: 'text',
    loc: '',
  },
  {
    action: 'draw',
    icon: 'edit-draw',
    l10n_name: 'draw',
    loc: '',
  },
  {
    action: 'cancel',
    icon: 'close',
    l10n_name: 'cancel-edit',
    loc: '',
  },
];

function bthHtml(btn) {
  return /*html*/ `
<button 
  action="${btn.action}" 
  ref="${btn.ref}"
  l10n="title:${btn.l10n_name}">
  <uc-icon-ui 
    loc="${btn.loc}" 
    name="${btn.icon}">
  </uc-icon-ui>
</button>`.trim();
}

export function getButtons() {
  return buttonsModel.reduce((acc, btn) => {
    return (acc += bthHtml(btn));
  }, '');
}
