import {} from '../../live-html/index.js';

let target = document.location.search.replace('?', '');

if (target) {
  window.onload = () => {
    let liveEl = document.querySelector('live-html');
    liveEl.setAttribute('src', target);
  };
}
