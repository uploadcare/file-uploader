import { Img } from './Img.js';

Img.reg('uc-img');
let img = new Img();
// img.style.setProperty('--uc-img-pubkey', '364c0864158c27472ffe'); // ???
img.setAttribute('pubkey', '364c0864158c27472ffe');
// TODO: no size case
img.setAttribute('width', '400');
img.setAttribute('src', 'https://uploadcare.github.io/uc-blocks/assets/media/kitten.jpg');

document.querySelector('#viewport')?.appendChild(img);
