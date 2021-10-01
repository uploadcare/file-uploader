export const buttonsModel = [
  {
    action: 'fullscreen',
    icon: '',
    l10n_name: 'toggle-fullscreen',
    set: '@name: fsIcon',
  },
  // {
  //   action: 'guides',
  //   icon: 'edit-guides',
  //   l10n_name: 'toggle-guides',
  //   set: '',
  // },
  {
    action: 'rotate_cw',
    icon: 'edit-rotate',
    l10n_name: 'rotate',
    set: '',
  },
  {
    action: 'flip_v',
    icon: 'edit-flip-v',
    l10n_name: 'flip-vertical',
    set: '',
  },
  {
    action: 'flip_h',
    icon: 'edit-flip-h',
    l10n_name: 'flip-horizontal',
    set: '',
  },
  {
    action: 'brightness',
    icon: 'edit-brightness',
    l10n_name: 'brightness',
    set: '',
  },
  {
    action: 'contrast',
    icon: 'edit-contrast',
    l10n_name: 'contrast',
    set: '',
  },
  {
    action: 'saturation',
    icon: 'edit-saturation',
    l10n_name: 'saturation',
    set: '',
  },
  // {
  //   action: 'resize',
  //   icon: 'edit-resize',
  //   l10n_name: 'resize',
  //   set: '',
  // },
  // {
  //   action: 'crop',
  //   icon: 'edit-crop',
  //   l10n_name: 'crop',
  //   set: '',
  // },
  {
    action: 'color',
    icon: 'edit-color',
    l10n_name: 'select-color',
    set: '',
    ref: 'color_btn',
  },
  {
    action: 'text',
    icon: 'edit-text',
    l10n_name: 'text',
    set: '',
  },
  {
    action: 'draw',
    icon: 'edit-draw',
    l10n_name: 'draw',
    set: '',
  },
  {
    action: 'cancel',
    icon: 'close',
    l10n_name: 'cancel-edit',
    set: '',
  },
];

function bthHtml(btn) {
  return /*html*/ `
<button 
  action="${btn.action}" 
  ref="${btn.ref}"
  l10n="title:${btn.l10n_name}">
  <uc-icon
    set="${btn.set}" 
    name="${btn.icon}">
  </uc-icon>
</button>`.trim();
}

export function getButtons() {
  return buttonsModel.reduce((acc, btn) => {
    return (acc += bthHtml(btn));
  }, '');
}
