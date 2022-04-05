import { BaseComponent } from '../../submodules/symbiote/core/BaseComponent.js';
import { initStyles } from './styles.js';

initStyles(() => {
  document.body.removeAttribute('unresolved');
});

class AppShell extends BaseComponent {
  processInnerHtml = true;

  init$ = {
    test: true,
  };
}

AppShell.shadowStyles = /*css*/ `
:host {
  display: block;
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
  padding: 10px;
  background-color: rgba(0, 0, 0, .3);
  height: 100%;
  backdrop-filter: blur(4px);
}
nav > div {
  display: flex;
  justify-content: space-around;
  width: 100%;
  max-width: 1080px;
}
a {
  display: block;
  color: var(--clr-font);
  margin: 10px;
  text-decoration: none;
}
main {
  display: flex;
  justify-content: center;
  padding: 20px;
}
col-css {
  display: block;
  max-width: 1080px;
}
footer {
  padding: 20px;
  background-color: rgba(0, 0, 0, .2);
}
`;

AppShell.template = /*html*/ `
<header>🟡 Uploadcare | uc-blocks</header>
<nav>
  <div>
    <a href="/">Home</a>
    <a href="/blocks/">Blocks</a>
    <a href="/solutions/">Solutions</a>
    <a href="/toc">TOC</a>
  </div>
</nav>
<main>
  <col-css>
    <slot></slot>
  </col-css>
</main>
<footer>© 2022 🦆</footer>
`;
AppShell.reg('app-shell');
