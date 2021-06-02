const UC_OBJ_NAME = 'uploadcare';
const UC_SCRIPT_SRC = 'https://ucarecdn.com/libs/widget/3.x/uploadcare.full.min.js';

function handleScript() {
  return new Promise((resolve, reject) => {
    /** @type {HTMLScriptElement} */
    let ownScript = document.querySelector('script[src*="uploadcare.full.min.js"]');
    if (!ownScript) {
      let script = document.createElement('script');
      script.src = UC_SCRIPT_SRC;
      document.head.appendChild(script);
      script.onerror = () => {
        reject(null);
      }
      script.onload = () => {
        resolve(window[UC_OBJ_NAME]);
      };
    } else {
      ownScript.onload = () => {
        window.setTimeout(() => {
          resolve(window[UC_OBJ_NAME]);
        });
      }
    }
  });
}

function createInput() {
  let input = document.createElement('input');
  input.type = 'hidden';
  input.setAttribute('role', 'uploadcare-uploader');
  input.setAttribute('name', 'my_file');
  return input;
}

/**
 * 
 * @param {ShadowRoot} targetContainer 
 * @param {Boolean} [removeOriginal]
 */
function copyStyle(targetContainer, removeOriginal = false) {
  let styles = document.querySelectorAll('style');
  let style = [...styles].find((stl) => {
    return stl.textContent.includes('.uploadcare--jcrop-handle');
  });
  let styleCopy = style.cloneNode(true);
  targetContainer.prepend(styleCopy);
  if (removeOriginal) {
    style.remove();
  }
}

// No Shadow DOM:

export class LegacyUploaderWc extends HTMLElement {
  connectedCallback() {
    this.input = createInput();
    this.appendChild(this.input);
    this.pubkey = this.getAttribute('pubkey');
    window['UPLOADCARE_PUBLIC_KEY'] = this.pubkey;
    handleScript();
  }
}

// Has Shadow DOM:

export class LegacyUploaderWcShadow extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({
      mode: 'open',
    });
    this.shadowRoot.appendChild(document.createElement('slot'));
    this.input = createInput()
    this.shadowRoot.appendChild(this.input);
    handleScript().then((ucObj) => {
      this.ucare = ucObj;
      console.log(this.ucare);
      window.setTimeout(() => {
        copyStyle(this.shadowRoot);
      });
    });
  }

  connectedCallback() {
    this.pubkey = this.getAttribute('pubkey'); 
    this.onclick = () => {
      this.ucare.openPanel(this.input, undefined, {
        publicKey: this.pubkey,
      });
    }
  }
}
