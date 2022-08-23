export default /*html*/ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>blocks</title>
    <script async src="https://unpkg.com/es-module-shims@1.5.8/dist/es-module-shims.js"></script>
    <script type="importmap">{{IMPORTMAP}}</script>
    <script type="module" src="https://unpkg.com/@re4ma/re4ma@0.1.7/build/re4ma.js"></script>
    <script type="module">
      import { LiveHtml } from '{{BASE}}blocks/LiveHtml/LiveHtml.js';
      LiveHtml.reg('lr-live-html');
    </script>
    <script type="module">{{JS}}</script>
    <style>{{CSS}}</style>
  </head>
  <body>
    <header>🟡 Uploadcare | blocks</header>
    <nav>
      <div>
        <a href="{{BASE}}">Home</a>
        <a href="{{BASE}}solutions/">Solutions</a>
        <a href="{{BASE}}blocks/">Blocks</a>
        <a href="{{BASE}}toc.html">TOC</a>
        <a href="//github.com/uploadcare/uc-blocks/discussions">Discussions</a>
      </div>
    </nav>
    <main>
      <col-css>{{CONTENT}}</col-css>
    </main>
    <footer>© 2022 🦆</footer>
  </body>
</html>
`;
