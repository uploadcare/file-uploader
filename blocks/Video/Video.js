import { Block } from '../../abstract/Block.js';

/** @enum {String} */
const ICO_MAP = {
  PLAY: 'play',
  PAUSE: 'pause',
  FS_ON: 'fullscreen-on',
  FS_OFF: 'fullscreen-off',
  VOL_ON: 'unmute',
  VOL_OFF: 'mute',
  CAP_ON: 'captions',
  CAP_OFF: 'captions-off',
};

// TODO: refactor and move fullscreen adapter to utils:
const FSAPI = {
  requestFullscreen: (el) => {
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  },
  exitFullscreen: () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document['webkitExitFullscreen']) {
      document['webkitExitFullscreen']();
    }
  },
};

export class Video extends Block {
  togglePlay() {
    if (this._video.paused || this._video.ended) {
      this._video.play();
    } else {
      this._video.pause();
    }
  }

  toggleFullscreen() {
    if ((document.fullscreenElement || document['webkitFullscreenElement']) === this) {
      FSAPI.exitFullscreen();
    } else {
      FSAPI.requestFullscreen(this);
    }
  }

  toggleCaptions() {
    if (this.$.capIcon === ICO_MAP.CAP_OFF) {
      this.$.capIcon = ICO_MAP.CAP_ON;
      this._video.textTracks[0].mode = 'showing';
      window.localStorage.setItem(Video.is + ':captions', '1');
    } else {
      this.$.capIcon = ICO_MAP.CAP_OFF;
      this._video.textTracks[0].mode = 'hidden';
      window.localStorage.removeItem(Video.is + ':captions');
    }
  }

  toggleSound() {
    if (this.$.volIcon === ICO_MAP.VOL_ON) {
      this.$.volIcon = ICO_MAP.VOL_OFF;
      this.$.volumeDisabled = true;
      this._video.muted = true;
    } else {
      this.$.volIcon = ICO_MAP.VOL_ON;
      this.$.volumeDisabled = false;
      this._video.muted = false;
    }
  }

  setVolume(val) {
    window.localStorage.setItem(Video.is + ':volume', val);
    let volume = val ? val / 100 : 0;
    this._video.volume = volume;
  }

  /** @type {HTMLElement} */
  get progress() {
    return this.ref.progress;
  }

  init$ = {
    ...this.init$,
    src: '',
    ppIcon: ICO_MAP.PLAY,
    fsIcon: ICO_MAP.FS_ON,
    volIcon: ICO_MAP.VOL_ON,
    capIcon: ICO_MAP.CAP_OFF,
    totalTime: '00:00',
    currentTime: '00:00',
    progressCssWidth: '0',
    hasSubtitles: false,
    volumeDisabled: false,
    volumeValue: 0,
    onPP: () => {
      this.togglePlay();
    },
    onFs: () => {
      this.toggleFullscreen();
    },
    onCap: () => {
      this.toggleCaptions();
    },
    onMute: () => {
      this.toggleSound();
    },
    onVolChange: (e) => {
      // TODO: cast range.value instead of range.$.value
      let val = parseFloat(e.currentTarget.$.value);
      this.setVolume(val);
    },
    progressClicked: (e) => {
      let progressRect = this.progress.getBoundingClientRect();
      this._video.currentTime = this._video.duration * (e.offsetX / progressRect.width);
    },
  };

  /**
   * @private
   * @param {String} input
   */
  _getUrl(input) {
    return input.includes('/') ? input : `https://ucarecdn.com/${input}/`;
  }

  /**
   * @private
   * @param {Object<string, any>} desc
   */
  _desc2attrs(desc) {
    let attrs = [];
    for (let attr in desc) {
      let val = attr === 'src' ? this._getUrl(desc[attr]) : desc[attr];
      attrs.push(`${attr}="${val}"`);
    }
    return attrs.join(' ');
  }

  /**
   * @private
   * @param {Number} seconds
   */
  _timeFmt(seconds) {
    // TODO: add hours
    let date = new Date(Math.round(seconds) * 1000);
    return [date.getMinutes(), date.getSeconds()]
      .map((n) => {
        return n < 10 ? '0' + n : n;
      })
      .join(':');
  }

  /** @private */
  _initTracks() {
    [...this._video.textTracks].forEach((track) => {
      track.mode = 'hidden';
    });
    if (window.localStorage.getItem(Video.is + ':captions')) {
      this.toggleCaptions();
    }
  }

  /** @private */
  _castAttributes() {
    let toCast = ['autoplay', 'loop', 'muted'];
    [...this.attributes].forEach((attr) => {
      if (toCast.includes(attr.name)) {
        this._video.setAttribute(attr.name, attr.value);
      }
    });
  }

  initCallback() {
    super.initCallback();
    /**
     * @private
     * @type {HTMLVideoElement}
     */
    this._video = this.ref.video;

    this._castAttributes();

    this._video.addEventListener('play', () => {
      this.$.ppIcon = ICO_MAP.PAUSE;
      this.setAttribute('playback', '');
    });

    this._video.addEventListener('pause', () => {
      this.$.ppIcon = ICO_MAP.PLAY;
      this.removeAttribute('playback');
    });

    this.addEventListener('fullscreenchange', (e) => {
      console.log(e);
      if (document.fullscreenElement === this) {
        this.$.fsIcon = ICO_MAP.FS_OFF;
      } else {
        this.$.fsIcon = ICO_MAP.FS_ON;
      }
    });

    this.sub('src', (src) => {
      if (!src) {
        return;
      }
      let url = this._getUrl(src);
      this._video.src = url;
    });

    this.sub('video', async (descPath) => {
      if (!descPath) {
        return;
      }
      let desc = await (await window.fetch(this._getUrl(descPath))).json();

      if (desc.poster) {
        this._video.poster = this._getUrl(desc.poster);
      }

      let html = '';
      desc?.sources.forEach((srcDesc) => {
        html += /* HTML */ `<source ${this._desc2attrs(srcDesc)} />`;
      });

      if (desc.tracks) {
        desc.tracks.forEach((trackDesc) => {
          html += /* HTML */ `<track ${this._desc2attrs(trackDesc)} />`;
        });
        this.$.hasSubtitles = true;
      }

      this._video.innerHTML += html;

      this._initTracks();
      console.log(desc);
    });

    this._video.addEventListener('loadedmetadata', (e) => {
      this.$.currentTime = this._timeFmt(this._video.currentTime);
      this.$.totalTime = this._timeFmt(this._video.duration);
    });

    this._video.addEventListener('timeupdate', (e) => {
      let perc = Math.round(100 * (this._video.currentTime / this._video.duration));
      this.$.progressCssWidth = perc + '%';
      this.$.currentTime = this._timeFmt(this._video.currentTime);
    });

    let volume = window.localStorage.getItem(Video.is + ':volume');
    if (volume) {
      let vol = parseFloat(volume);
      this.setVolume(vol);
      this.$.volumeValue = vol;
    }
  }
}

Video.template = /* HTML */ `
  <div class="video-wrapper">
    <video ref="video" preload="metadata" crossorigin="anonymous"></video>
  </div>

  <div class="toolbar">
    <div class="progress" ref="progress" set -onclick="progressClicked">
      <div class="bar" set -style.width="progressCssWidth"></div>
    </div>

    <div class="tb-block">
      <button set -onclick="onPP">
        <lr-icon set -@name="ppIcon"></lr-icon>
      </button>
      <div class="timer">{{currentTime}} / {{totalTime}}</div>
    </div>

    <div class="tb-block">
      <button set -onclick="onCap" -@hidden="!hasSubtitles">
        <lr-icon set -@name="capIcon"></lr-icon>
      </button>

      <button set -onclick="onMute">
        <lr-icon set -@name="volIcon"></lr-icon>
      </button>

      <lr-range type="range" set -onchange="onVolChange" -@disabled="volumeDisabled" -value="volumeValue"> </lr-range>

      <button set -onclick="onFs">
        <lr-icon set -@name="fsIcon"></lr-icon>
      </button>
    </div>
  </div>
`;

Video.bindAttributes({
  video: 'video',
  src: 'src',
});
