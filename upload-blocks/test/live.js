import { LiveHtmlElement } from '../../live-html-element/live-html-element.js';
window.customElements.define('live-html', LiveHtmlElement);

let search = window.location.search.replace('?', '');
if (!search) {
  search = 'test';
}
let live = new LiveHtmlElement();
live.setAttribute('src', `${search}.html`);
live.style.height = '100vh';
live.setAttribute('console-output', '');
document.body.appendChild(live);