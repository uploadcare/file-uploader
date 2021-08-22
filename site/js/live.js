import { LiveHtmlElement } from '../../live-html-element/live-html-element.js';
export { ReHtm, ReMd, ReCss, ReImg, ReCode, ReJs, RePeat } from '../../re4ma/render/render.js';

const LIVE_HTML_TAG = 'live-html';
LiveHtmlElement.reg(LIVE_HTML_TAG);

let target = document.location.search.replace('?', '');

if (target) {
  window.onload = () => {
    let liveEl = document.querySelector(LIVE_HTML_TAG);
    liveEl.setAttribute('src', target);
  };
}
