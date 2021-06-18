import { applyStyles } from '../lib/applyStyles.js';
import { renderToFragment } from '../lib/renderToFragment.js';
import { getRefs } from '../lib/getRefs.js';

const TEMPLATE = /*html*/ `
<video ref="video"></video>
<div ref="toolbar">
  <button ref="playBtn" icon="👉🏼" title="play">Play</button>
  <button ref="pauseBtn" icon="✋🏼" title="pause">Pause</button>
</div>
`;

const STYLES = {
  host: {
    display: 'inline-grid',
    'grid-gap': 'var(--gap-min)',
    opacity: 'var(--shadow-opacity, 1)',
    padding: 'var(--gap-mid)',
    border: 'var(--line-width, 1px) solid rgb(var(--rgb-2))',
    'border-radius': 'var(--radius)',
    transition: 'opacity var(--ui-transition-speed, 1s)',
  },
  toolbar: {
    display: 'grid',
    'grid-template-columns': 'min-content min-content',
    'grid-gap': 'var(--gap-min)',
  },
};

export class UcVideo extends HTMLElement {
  constructor() {
    super();
    this.fragment = renderToFragment(TEMPLATE);
    this.refs = getRefs(this.fragment);
    applyStyles(this, STYLES.host);
    applyStyles(this.refs.toolbar, STYLES.toolbar);

    this.refs.playBtn.onclick = () => {
      this.refs.video.play();
    };
    this.refs.pauseBtn.onclick = () => {
      this.refs.video.pause();
    };
  }

  connectedCallback() {
    this.appendChild(this.fragment);
  }

  static get observedAttributes() {
    return ['uuid', 'lazy', 'autoplay', 'controls', 'poster', 'loop', 'muted'];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    let react = {
      [UcVideo.observedAttributes[0]]: (val) => {
        if (val) {
          this.videoUrl = `https://ucarecdn.com/${val}/`;
          this.refs.video.src = this.videoUrl;
        }
      },
    };
    react[name]?.(newVal);
  }
}
