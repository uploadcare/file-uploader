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
  background-color: rgba(0, 0, 0, .2);
}
nav {
  position: fixed;
  left: 0;
  padding: 20px;
}
a {
  display: block;
  color: var(--clr-font);
  margin-top: 10px;
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
<main>
  <nav>
    <a href="//">Home</a>
    <a href="//blocks/">Blocks</a>
    <a href="//solutions/">Solutions</a>
  </nav>
  <col-css>
    <slot></slot>
  </col-css>
</main>
<footer>© 2022 🦆</footer>
`;
AppShell.reg('app-shell');
