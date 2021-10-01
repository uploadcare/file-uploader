/** @type {Readonly<{ [key: string]: { w: import('./ucIconHtml.js').IconSize; g?: string; p?: string } }>} */
export const UC_ICONS = Object.freeze({
  edit: {
    w: 20,
    p: 'M5.51389 17.6793L1 19.151l1.5-4.4288m3.01389 2.9571L2.5 14.7222m3.01389 2.9571L17.0139 6.39623M2.5 14.7222L14 3.43921m3.0139 2.95702l1.7586-1.72539c.3995-.39201.3995-1.03561 0-1.42762l-1.586-1.55609c-.389-.38159-1.0118-.38159-1.4007 0L14 3.43921m3.0139 2.95702L14 3.43921',
  },
  closeMax: { w: 20, p: 'M3 3l14 14m0-14L3 17' },
  more: { w: 10, p: 'M.5 3L5 7l4.5-4' },
  check: { w: 10, p: 'M.5 5.31579l2.84211 2.8421L9.5 2' },
  arrowRight: { w: 20, p: 'M1 10h17M10.8421 3L18 10l-7.1579 7' },
  done: { w: 20, p: 'M1 10.6316l5.68421 5.6842L19 4' },
  dropzone: { w: 20, p: 'M4.154 6.902L10 1l5.846 5.902M.5 19h19M10 15.016V1.01' },
  crop: {
    w: 20,
    p: 'M20 14H7.00513C6.45001 14 6 13.55 6 12.9949V0M0 6h13.0667c.5154 0 .9333.41787.9333.93333V20M14.5.399902L13 1.9999l1.5 1.6M13 2h2c1.6569 0 3 1.34315 3 3v2M5.5 19.5999l1.5-1.6-1.5-1.6M7 18H5c-1.65685 0-3-1.3431-3-3v-2',
  },
  sliders: {
    w: 20,
    p: 'M8 10h11M1 10h4M1 4.5h11m3 0h4m-18 11h11m3 0h4M12 4.5a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M5 10a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M12 15.5a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0',
  },
  filters: {
    w: 20,
    p: 'M4.5 6.5a5.5 5.5 0 1011 0 5.5 5.5 0 10-11 0m-3.5 6a5.5 5.5 0 1011 0 5.5 5.5 0 10-11 0m7 0a5.5 5.5 0 1011 0 5.5 5.5 0 10-11 0',
  },
  abort: {
    w: 10,
    p: 'M.625.625l8.75 8.75m0-8.75l-8.75 8.75',
  },
  exposure: {
    w: 20,
    p: 'M10 20v-3M2.92946 2.92897l2.12132 2.12132M0 10h3m-.07054 7.071l2.12132-2.1213M10 0v3m7.0705 14.071l-2.1213-2.1213M20 10h-3m.0705-7.07103l-2.1213 2.12132M5 10a5 5 0 1010 0 5 5 0 10-10 0',
  },
  contrast: {
    w: 20,
    p: 'M2 10a8 8 0 1016 0 8 8 0 10-16 0m8-8v16m8-8h-8m7.5977 2.5H10m6.24 2.5H10m7.6-7.5H10M16.2422 5H10',
  },
  rotate: {
    w: 20,
    p: 'M13.5.399902L12 1.9999l1.5 1.6M12.0234 2H14.4C16.3882 2 18 3.61178 18 5.6V8M4 17h9c.5523 0 1-.4477 1-1V7c0-.55228-.4477-1-1-1H4c-.55228 0-1 .44771-1 1v9c0 .5523.44771 1 1 1z',
  },
  mirror: {
    w: 20,
    p: 'M5.00042.399902l-1.5 1.599998 1.5 1.6M15.0004.399902l1.5 1.599998-1.5 1.6M3.51995 2H16.477M8.50042 16.7V6.04604c0-.30141-.39466-.41459-.5544-.159L1.28729 16.541c-.12488.1998.01877.459.2544.459h6.65873c.16568 0 .3-.1343.3-.3zm2.99998 0V6.04604c0-.30141.3947-.41459.5544-.159L18.7135 16.541c.1249.1998-.0187.459-.2544.459h-6.6587c-.1657 0-.3-.1343-.3-.3z',
  },
  flip: {
    w: 20,
    p: 'M19.6001 4.99993l-1.6-1.5-1.6 1.5m3.2 9.99997l-1.6 1.5-1.6-1.5M18 3.52337V16.4765M3.3 8.49993h10.654c.3014 0 .4146-.39466.159-.5544L3.459 1.2868C3.25919 1.16192 3 1.30557 3 1.5412v6.65873c0 .16568.13432.3.3.3zm0 2.99997h10.654c.3014 0 .4146.3947.159.5544L3.459 18.7131c-.19981.1248-.459-.0188-.459-.2544v-6.6588c0-.1657.13432-.3.3-.3z',
  },
  brightness: {
    w: 20,
    p: 'M15 10c0 2.7614-2.2386 5-5 5m5-5c0-2.76142-2.2386-5-5-5m5 5h-5m0 5c-2.76142 0-5-2.2386-5-5 0-2.76142 2.23858-5 5-5m0 10V5m0 15v-3M2.92946 2.92897l2.12132 2.12132M0 10h3m-.07054 7.071l2.12132-2.1213M10 0v3m7.0705 14.071l-2.1213-2.1213M20 10h-3m.0705-7.07103l-2.1213 2.12132M14.3242 7.5H10m4.3242 5H10',
  },
  gamma: {
    w: 20,
    p: 'M17 3C9 6 2.5 11.5 2.5 17.5m0 0h1m-1 0v-1m14 1h1m-3 0h1m-3 0h1m-3 0h1m-3 0h1m-3 0h1m-3 0h1m-3-14v-1m0 3v-1m0 3v-1m0 3v-1m0 3v-1m0 3v-1m0 3v-1',
  },
  saturation: {
    w: 20,
    g: /*html*/ `
      <circle cx="10.0006" cy="10.0001" r="9" transform="rotate(90 10.0006 10.0001)" fill="url(#paint0_linear)"/>
      <defs>
        <linearGradient id="paint0_linear" x1="10.0006" y1="1.00009" x2="10.0006" y2="19.0001" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DE15FF"/>
          <stop offset=".203125" stop-color="#0029FF"/>
          <stop offset=".479167" stop-color="#2AE4F0"/>
          <stop offset=".604167" stop-color="#15EF11"/>
          <stop offset=".75" stop-color="#FAE528"/>
          <stop offset="1" stop-color="#EB2A2A"/>
        </linearGradient>
      </defs>
    `,
  },
  enhance: {
    w: 20,
    p: 'M19 13h-2m0 0c-2.2091 0-4-1.7909-4-4m4 4c-2.2091 0-4 1.7909-4 4m0-8V7m0 2c0 2.2091-1.7909 4-4 4m-2 0h2m0 0c2.2091 0 4 1.7909 4 4m0 0v2M8 8.5H6.5m0 0c-1.10457 0-2-.89543-2-2m2 2c-1.10457 0-2 .89543-2 2m0-4V5m0 1.5c0 1.10457-.89543 2-2 2M1 8.5h1.5m0 0c1.10457 0 2 .89543 2 2m0 0V12M12 3h-1m0 0c-.5523 0-1-.44772-1-1m1 1c-.5523 0-1 .44772-1 1m0-2V1m0 1c0 .55228-.44772 1-1 1M8 3h1m0 0c.55228 0 1 .44772 1 1m0 0v1',
  },
  slider: {
    w: 20,
    p: 'M0 10h11m0 0c0 1.1046.8954 2 2 2s2-.8954 2-2m-4 0c0-1.10457.8954-2 2-2s2 .89543 2 2m0 0h5',
  },
  diagonal: {
    w: 40,
    p: 'M0 40L40-.00000133',
  },
  exclamation: {
    w: 20,
    p: 'M10 0v14m1 4c0 .5523-.4477 1-1 1-.55228 0-1-.4477-1-1s.44772-1 1-1c.5523 0 1 .4477 1 1z',
  },
  sad: {
    w: 20,
    p: 'M2 17c4.41828-4 11.5817-4 16 0M16.5 5c0 .55228-.4477 1-1 1s-1-.44772-1-1 .4477-1 1-1 1 .44772 1 1zm-11 0c0 .55228-.44772 1-1 1s-1-.44772-1-1 .44772-1 1-1 1 .44772 1 1z',
  },
  warmth: {
    w: 20,
    g: /*html*/ `
      <path d="M7.5 13.0505l.42854.4199.17146-.1749v-.245h-.6zm5 0h-.6v.245l.1715.1749.4285-.4199zM8.1 3.5c0-1.04934.85066-1.9 1.9-1.9V.4C8.28792.4 6.9 1.78792 6.9 3.5h1.2zm0 9.5505V3.5H6.9v9.5505h1.2zM7.1 15.5c0-.7904.31539-1.5059.82854-2.0296l-.85708-.8398C6.34742 13.3694 5.9 14.3831 5.9 15.5h1.2zm2.9 2.9c-1.60163 0-2.9-1.2984-2.9-2.9H5.9c0 2.2644 1.83563 4.1 4.1 4.1v-1.2zm2.9-2.9c0 1.6016-1.2984 2.9-2.9 2.9v1.2c2.2644 0 4.1-1.8356 4.1-4.1h-1.2zm-.8285-2.0296c.5131.5237.8285 1.2392.8285 2.0296h1.2c0-1.1169-.4474-2.1306-1.1715-2.8694l-.857.8398zM11.9 3.5v9.5505h1.2V3.5h-1.2zM10 1.6c1.0493 0 1.9.85066 1.9 1.9h1.2c0-1.71208-1.3879-3.1-3.1-3.1v1.2z" fill="currentColor"/>
      <path d="M10 14V8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M14 3h3m-3 3h3m-3 3h3m-8 6.5a1 1 0 102 0 1 1 0 10-2 0" stroke="currentColor" stroke-width="1.2"/>
    `,
  },
  vibrance: {
    w: 20,
    g: /*html*/ `
      <path d="M2.125 5.6407c-.71643 1.29152-1.12439 2.77782-1.12439 4.3594 0 1.5816.40796 3.0679 1.12439 4.3594V5.6407z" fill="url(#paint0_linear)"/>
      <path d="M2.875 15.4986V4.5016c.50222-.64987 1.09136-1.22915 1.75-1.72041V17.219c-.65864-.4912-1.24778-1.0705-1.75-1.7204z" fill="url(#paint1_linear)"/>
      <path d="M5.375 17.722c.54811.3291 1.13415.6014 1.75.8089V1.46929c-.61585.20751-1.20189.47984-1.75.80888V17.722z" fill="url(#paint2_linear)"/>
      <path d="M7.875 1.25258V18.7476c.56442.1367 1.14962.2202 1.75.2448V1.0078c-.60038.02465-1.18558.10811-1.75.24478z" fill="url(#paint3_linear)"/>
      <path d="M10.375 1.00775V18.9925c.6004-.0246 1.1856-.108 1.75-.2446V1.25228c-.5644-.13658-1.1496-.21996-1.75-.24453z" fill="url(#paint4_linear)"/>
      <path d="M12.875 1.46887V18.5313c.6158-.2074 1.2019-.4796 1.75-.8085V2.27744c-.5481-.32893-1.1342-.60115-1.75-.80857z" fill="url(#paint5_linear)"/>
      <path d="M15.375 2.78028V17.2199c.6586-.491 1.2477-1.0701 1.75-1.7197V4.50002c-.5023-.64963-1.0914-1.22868-1.75-1.71974z" fill="url(#paint6_linear)"/>
      <path d="M17.875 5.6385v8.7232c.7172-1.292 1.1256-2.7791 1.1256-4.3616 0-1.58248-.4084-3.06956-1.1256-4.3616z" fill="url(#paint7_linear)"/>
      <defs>
        <linearGradient id="paint0_linear" x1="19.0006" y1="10.0001" x2="1.00061" y2="10.0001" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DE15FF"/>
          <stop offset=".203125" stop-color="#0029FF"/>
          <stop offset=".479167" stop-color="#2AE4F0"/>
          <stop offset=".604167" stop-color="#15EF11"/>
          <stop offset=".75" stop-color="#FAE528"/>
          <stop offset="1" stop-color="#EB2A2A"/>
        </linearGradient>
        <linearGradient id="paint1_linear" x1="19.0006" y1="10.0001" x2="1.00061" y2="10.0001" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DE15FF"/>
          <stop offset=".203125" stop-color="#0029FF"/>
          <stop offset=".479167" stop-color="#2AE4F0"/>
          <stop offset=".604167" stop-color="#15EF11"/>
          <stop offset=".75" stop-color="#FAE528"/>
          <stop offset="1" stop-color="#EB2A2A"/>
        </linearGradient>
        <linearGradient id="paint2_linear" x1="19.0006" y1="10.0001" x2="1.00061" y2="10.0001" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DE15FF"/>
          <stop offset=".203125" stop-color="#0029FF"/>
          <stop offset=".479167" stop-color="#2AE4F0"/>
          <stop offset=".604167" stop-color="#15EF11"/>
          <stop offset=".75" stop-color="#FAE528"/>
          <stop offset="1" stop-color="#EB2A2A"/>
        </linearGradient>
        <linearGradient id="paint3_linear" x1="19.0006" y1="10.0001" x2="1.00061" y2="10.0001" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DE15FF"/>
          <stop offset=".203125" stop-color="#0029FF"/>
          <stop offset=".479167" stop-color="#2AE4F0"/>
          <stop offset=".604167" stop-color="#15EF11"/>
          <stop offset=".75" stop-color="#FAE528"/>
          <stop offset="1" stop-color="#EB2A2A"/>
        </linearGradient>
        <linearGradient id="paint4_linear" x1="19.0006" y1="10.0001" x2="1.00061" y2="10.0001" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DE15FF"/>
          <stop offset=".203125" stop-color="#0029FF"/>
          <stop offset=".479167" stop-color="#2AE4F0"/>
          <stop offset=".604167" stop-color="#15EF11"/>
          <stop offset=".75" stop-color="#FAE528"/>
          <stop offset="1" stop-color="#EB2A2A"/>
        </linearGradient>
        <linearGradient id="paint5_linear" x1="19.0006" y1="10.0001" x2="1.00061" y2="10.0001" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DE15FF"/>
          <stop offset=".203125" stop-color="#0029FF"/>
          <stop offset=".479167" stop-color="#2AE4F0"/>
          <stop offset=".604167" stop-color="#15EF11"/>
          <stop offset=".75" stop-color="#FAE528"/>
          <stop offset="1" stop-color="#EB2A2A"/>
        </linearGradient>
        <linearGradient id="paint6_linear" x1="19.0006" y1="10.0001" x2="1.00061" y2="10.0001" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DE15FF"/>
          <stop offset=".203125" stop-color="#0029FF"/>
          <stop offset=".479167" stop-color="#2AE4F0"/>
          <stop offset=".604167" stop-color="#15EF11"/>
          <stop offset=".75" stop-color="#FAE528"/>
          <stop offset="1" stop-color="#EB2A2A"/>
        </linearGradient>
        <linearGradient id="paint7_linear" x1="19.0006" y1="10.0001" x2="1.00061" y2="10.0001" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DE15FF"/>
          <stop offset=".203125" stop-color="#0029FF"/>
          <stop offset=".479167" stop-color="#2AE4F0"/>
          <stop offset=".604167" stop-color="#15EF11"/>
          <stop offset=".75" stop-color="#FAE528"/>
          <stop offset="1" stop-color="#EB2A2A"/>
        </linearGradient>
      </defs>
    `,
  },
  dropbox: {
    w: 30,
    g: /*html*/ `
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8.90599 4.6875L2.8125 8.56969L8.90599 12.4519L2.8125 16.3341L8.90599 20.2163L15.0005 16.3341L21.094 20.2163L27.1875 16.3341L21.094 12.4519L27.1875 8.56969L21.094 4.6875L15.0005 8.56969L8.90599 4.6875ZM15.0005 8.56969L21.094 12.4519L15.0005 16.3341L8.90599 12.4519L15.0005 8.56969ZM15.0005 25.3925L8.90599 21.5103L15.0005 17.6281L21.094 21.5103L15.0005 25.3925Z"
        fill="#1F66F6"
      />
    `,
  },
  googleDrive: {
    w: 30,
    g: /*html*/ `
      <path d="M7.30786 24.2267L11.1537 17.6897H26.5384L22.6922 24.2267H7.30786Z" fill="#3777E3" />
      <path d="M18.8462 17.6894H26.5382L18.8462 4.61539H11.1536L18.8462 17.6894Z" fill="#FFCF63" />
      <path d="M3.46143 17.6901L7.30782 24.2271L14.9999 11.1531L11.1537 4.61606L3.46143 17.6901Z" fill="#11A861" />
    `,
  },
  link: {
    w: 30,
    g: /*html*/ `
      <path fill="none" d="M12.5 20H8.5C5.73858 20 3.5 17.7614 3.5 15C3.5 12.2386 5.73858 10 8.5 10H12.5C15.2614 10 17.5 12.2386 17.5 15C17.5 15.9107 17.2565 16.7646 16.8311 17.5M17.5 10H21.5C24.2614 10 26.5 12.2386 26.5 15C26.5 17.7614 24.2614 20 21.5 20H17.5C14.7386 20 12.5 17.7614 12.5 15C12.5 14.0893 12.7435 13.2354 13.1689 12.5" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    `,
  },
  camera: {
    w: 30,
    g: /*html*/ `
      <path fill="none" d="M4 11C4 9.34315 5.34315 8 7 8H23C24.6569 8 26 9.34315 26 11V20C26 21.6569 24.6569 23 23 23H7C5.34315 23 4 21.6569 4 20V11Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
      <path fill="none" d="M19.5 15.5C19.5 17.9853 17.4853 20 15 20C12.5147 20 10.5 17.9853 10.5 15.5C10.5 13.0147 12.5147 11 15 11C17.4853 11 19.5 13.0147 19.5 15.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
      <path fill="none" d="M22.5 12C22.5 11.7239 22.2761 11.5 22 11.5C21.7239 11.5 21.5 11.7239 21.5 12C21.5 12.2761 21.7239 12.5 22 12.5C22.2761 12.5 22.5 12.2761 22.5 12Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    `,
  },
});
