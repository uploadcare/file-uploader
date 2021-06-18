import { applyElementStyles } from '../symbiote/core/css_utils.js';
import { highlight } from '../common-utils/highlight.js';

const svgBg = /*html*/ `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <rect x="0" y="0" fill="rgba(255, 255, 255, 0.06)" width="10" height="5" />
</svg>
`;

const EDITOR_STYLES = {
  'color': '#cff',
  'font-size': 'var(--font-size)',
  'line-height': 'var(--l-line-h)',
  'padding': 'var(--l-line-h)',
  'white-space': 'pre',
  'outline': 'none',
  'font-family': 'monospace',
  'cursor': 'text',
  'box-sizing': 'border-box',
  'min-height': 'calc(var(--l-line-h) * 15)',
  'min-width': '100%',
};

const STYLES = {
  host: {
    '--l-line-h': '18px',
    '--l-line-double': 'calc(var(--l-line-h) * 2)',
    '--font-size': 'calc(var(--l-line-h) - 6px)',

    'display': 'grid',
    'grid-template-columns': 'repeat(auto-fit, minmax(340px, 1fr))',
    border: '1px solid currentColor',
  },
  edit_wrapper: {
    'position': 'relative',
    'overflow': 'auto',
    'background-color': '#212121',
  },
  editor: {
    ...EDITOR_STYLES,
    'background-image': `url(data:image/svg+xml;base64,${btoa(svgBg)})`,
    'background-size': 'var(--l-line-double) var(--l-line-double)',
  },
  hl: {
    ...EDITOR_STYLES,
    'position': 'absolute',
    'top': 0,
    'color': 'transparent',
    'background-color': 'rgba(0, 0, 0, 0)',
    'background-image': 'none',
    'pointer-events': 'none',
  },
  vp: {
    'display': 'block',
    'width': '100%',
    height: '100%',
    border: 'none',
    'min-height': 'calc(var(--l-line-h) * 15)',
  },
};

const INIT_HTML = /*html*/ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  
</body>
</html>
`.trim();

const TPL = /*html*/ `
<div id="edit_wrapper">
<div id="editor" contenteditable="true"></div>
<div id="hl"></div>
</div> 
<iframe id="vp"></iframe>
`.trim();

/**
 * 
 * @param {HTMLElement} container 
 */
function applyWidgetStyles(container) {
  applyElementStyles(container, STYLES.host);
  [...container.querySelectorAll('[id]')].forEach((/** @type {HTMLElement} */ el) => {
    applyElementStyles(el, STYLES[el.getAttribute('id')]);
  });
}

export class LiveHtmlElement extends HTMLElement {

  /**
   * 
   * @param {String} id 
   * @returns {HTMLElement}
   */
  ref(id) {
    if (!this._refs) {
      this._refs = Object.create(null);
    }
    if (!this._refs[id]) {
      this._refs[id] = this.querySelector(`#${id}`);
    }
    return this._refs[id];
  }

  _hl() {
    this.ref('hl').innerHTML = highlight(this.ref('editor').textContent);
  }

  _update() {
    if (this._updTimeout) {
      window.clearTimeout(this._updTimeout);
    }
    this._updTimeout = window.setTimeout(() => {
      // @ts-ignore
      this.ref('vp').srcdoc = this.ref('editor').textContent;
    }, 300);
    this._hl();
  }

  _defaultHtml() {
    this.ref('editor').textContent = INIT_HTML;
    this._update();
  }

  constructor() {
    super();
    if (!LiveHtmlElement.template) {
      LiveHtmlElement.template = document.createElement('template');
      LiveHtmlElement.template.innerHTML = TPL;
    }
  }

  _render() {
    this.innerHTML = '';
    this.appendChild(LiveHtmlElement.template.content.cloneNode(true));
    applyWidgetStyles(this);
    this.ref('editor').spellcheck = false;

    this.ref('editor').oninput = () => {
      this._update();
    };

    this.ref('editor').onkeydown = (e) => {
      if (e.keyCode === 13) {
        e.preventDefault();
        document.execCommand('insertHTML', false, '\n');
      } else if (e.keyCode === 9) {
        e.preventDefault();
        document.execCommand('insertHTML', false, '&nbsp;&nbsp;');
      }
    };

    this.ref('editor').onpaste = (e) => {
      e.preventDefault();
      let text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    };

    this._initialized = true;
  }

  connectedCallback() {
    if (!this._initialized) {
      this._render();

      if (!this.hasAttribute('src')) {
        this._defaultHtml();
      }
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'src' && newVal) {
      window.fetch(newVal).then((resp) => {
        return resp.status === 200 && resp.text();
      }).then((txt) => {
        if (txt) {
          this.ref('editor').textContent = txt;
          this._update();
        } else {
          this._defaultHtml();
        }
      }).catch((e) => {
        this._defaultHtml();
      });
    }
  }

  static get observedAttributes() {
    return [
      'src',
    ];
  }
}

LiveHtmlElement.template = null;