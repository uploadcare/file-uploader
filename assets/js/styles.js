export const SHELL_CSS = /*css*/ `
:host {
  display: grid;
  grid-template-rows: min-content min-content auto min-content;
  min-height: 100vh;
}
header {
  padding: 20px;
  background-color: rgba(0, 0, 0, .4);
}
nav {
  display: flex;
  justify-content: center;
  position: sticky;
  top: 0;
  background-color: rgba(255, 255, 255, .1);
  height: 100%;
  backdrop-filter: blur(6px);
}
nav > div {
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 100%;
  max-width: 1080px;
}
a {
  display: block;
  color: var(--clr-font);
  margin: 20px;
  text-decoration: none;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, .6);
}
main {
  display: flex;
  justify-content: center;
  padding: 20px;
}
col-css {
  display: block;
  max-width: 1080px;
  width: 100%;
}
footer {
  padding: 20px;
  background-color: rgba(0, 0, 0, .2);
}
`;

export const DOC_CSS = /*css*/ `

uc-live-html {
  min-height: 400px;
}

a {
  color: var(--clr-link);
}

code {
  display: block;
  background-color: #000;
  color: var(--clr-code);
  padding: var(--gap-max);
  overflow-x: auto;
}

code .hl {
  color: var(--clr-code-hl);
}

code:not([class]) {
  display: inline-block;
  padding: var(--gap-min);
  padding-left: .5em;
  padding-right: .5em;
}

blockquote {
  display: block;
  color: var(--clr-accent);
  background-color: var(--clr-accent-shade);
  padding: var(--gap-mid);
  margin: 0;
  margin-top: var(--gap-max);
  border-left: var(--gap-min) solid currentColor;
}

h1 {
  color: var(--clr-accent);
}

h2 {
  margin-top: calc(var(--gap-max) * 3);
}

li {
  margin-bottom: var(--gap-mid);
}
`;

/** @param {() => void} cb */
export function initStyles(cb) {
  let blob = new Blob([DOC_CSS], {
    type: 'text/css',
  });
  let url = URL.createObjectURL(blob);
  let link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.onload = () => {
    cb();
  };
  document.head.appendChild(link);
}
