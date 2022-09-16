export default /*css*/ `
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;700&display=swap');

:root {
  --clr-bg: rgb(31 29 29);
  --clr-font: rgb(224 253 255);
  --clr-link: rgb(253 255 139);
  --clr-panel: rgb(255 255 255 / 10%);
  --clr-accent: rgb(233 159 255);
  --clr-accent-shade: rgb(233 159 255 / 6%);
  --clr-code: #fff;
  --clr-code-hl: rgb(255 112 112);

  --gap-min: 2px;
  --gap-mid: 10px;
  --gap-max: 20px;
  --gap-huge: 60px;
}

html,
body {
  margin: 0;
  padding: 0;
  color: var(--clr-font);
  font-family: Roboto, sans-serif;
  background-color: var(--clr-bg);
}

body {
  display: grid;
  grid-template-rows: min-content min-content auto min-content;
  min-height: 100vh;
}
header {
  padding: 20px;
  background-color: rgba(0, 0, 0, .4);
}
nav {
  --l-bg-clr: rgba(60, 60, 60, .9);
  --blur: 6px;
  display: flex;
  justify-content: center;
  position: sticky;
  z-index: 10000;
  top: 0;
  background-color: var(--l-bg-clr);
  height: 100%;
}

@supports ((-webkit-backdrop-filter: blur(var(--blur))) or (backdrop-filter: blur(var(--blur)))) {
  nav {
    --l-bg-clr: rgba(255, 255, 255, .1);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
  }
}
nav > div {
  display: flex;
  justify-content: end;
  align-items: center;
  width: 100%;
  max-width: 1300px;
}
nav a {
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
lr-live-html {
  min-height: 400px;
}

main a {
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

table {
  width: 100%;
}

th {
  padding: 10px;
  background: rgba(0, 0, 0, .4);
}

td {
  padding: 10px;
  background: rgba(255, 255, 255, .1);
}

tr:hover {
  background: rgba(255, 255, 255, .1);
}

.sidebar-wrapper {
  width: 14rem;
  padding-right: 1rem;
}

.sidebar {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  position: sticky;
  align-self: flex-start;
  top: 79px;
}

.sidebar a {
  color: rgb(224 253 255);
  text-decoration: none;
}

.menu-section {
  margin-bottom: 1rem;
}

.menu-item {
  padding: .5rem 0;
}

.menu-item:hover  {
  color: rgba(186,186,186,.9);
}

.current {
  color: aquamarine;
}

.level-1 {
  padding-left: .5rem; 
  font-weight: 600;
  cursor: pointer;
}

.level-2 {
  padding-left: 1.5rem;
  font-weight: 300;
  cursor: pointer;
}

.level-2 .current {
  list-style-type: disc;
}

.arrow-top {
  cursor: pointer;
  position: fixed;
  bottom: 15px;
  right: 15px;
}

.no-link {
  cursor: auto;
  color: rgb(224 253 255) !important;
}

a[target="_blank"]:after {
  content: url(/assets/media/external-link-icon.svg);
  margin-left: .1em;
  position: relative;
  bottom: 2px;
}

.github:before {
  content: url(/assets/media/github-icon.svg);
  margin-right: .1em;
  position: relative;
  top: 1px;
  vertical-align: sub;
}

`;
