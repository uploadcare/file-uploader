export default /*html*/ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blocks by Uploadcare</title>
    <script async src="https://cdn.skypack.dev/-/es-module-shims@v1.5.8-O0uWfhbenfjMbv6D3d8E/dist=es2020,mode=raw,min/dist/es-module-shims.js"></script>
    <script type="importmap">{{IMPORTMAP}}</script>
    <script type="module" src="https://cdn.skypack.dev/pin/@re4ma/re4ma@v0.1.7-2fpA2FBNkO473Jd06xxO/mode=imports,min/unoptimized/build/re4ma.js"></script>
    <script type="module">
      import { LiveHtml } from '{{BASE}}blocks/LiveHtml/LiveHtml.js';
      LiveHtml.reg('lr-live-html');
    </script>
    <style>{{CSS}}</style>
  </head>
  <body>
    <nav>
      <div>
      <span>🟡 Uploadcare | blocks</span>
        <a style="margin-left: auto" href="//uploadcare.com" target="_blank">Uploadcare</a>
        <a href="//github.com/uploadcare/blocks/discussions" target="_blank">Discussions</a>
        <a href="//github.com/uploadcare/blocks" class="github" target="_blank">GitHub</a>
      </div>
    </nav>
    <main>
    <div class="sidebar-wrapper">
        <div class="sidebar">
            <div class="menu-section">
                <a href="{{BASE}}"><div class="menu-item level-1">Get started</div></a>
                <a href="{{BASE}}get-started/installation/"><div class="menu-item level-2">Installation</div></a>
                <a href="{{BASE}}get-started/configuration/"><div class="menu-item level-2">Configuration</div></a>
                <a href="{{BASE}}get-started/localization/"><div class="menu-item level-2">Localization</div></a>
            </div>
            <div class="menu-section">
                <div class="menu-item level-1 no-link">Components</div>
                <a href="{{BASE}}solutions/file-uploader/"><div class="menu-item level-2">File Uploader</div></a>
                <a href="{{BASE}}solutions/adaptive-image/"><div class="menu-item level-2">Adaptive image</div></a>
                <a href="{{BASE}}solutions/cloud-image-editor/"><div class="menu-item level-2">Image editor</div></a>
            </div>
            <div class="menu-section">
                <a href="{{BASE}}blocks/"><div class="menu-item level-1">Customization</div></a>
            </div>
        </div>
    </div>
      <col-css>{{CONTENT}}</col-css>
    </main>
    <footer>© 2022 🦆</footer>
    <div class="arrow-top" onclick="scrollToTop()">
    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-arrow-up-circle" width="60" height="60" viewBox="0 0 24 24" stroke-width="1.5" stroke="#9e9e9e" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
  <circle cx="12" cy="12" r="9" />
  <line x1="12" y1="8" x2="8" y2="12" />
  <line x1="12" y1="8" x2="12" y2="16" />
  <line x1="16" y1="12" x2="12" y2="8" />
</svg>
</div>
  </body>
</html>
<script>
    document.addEventListener("DOMContentLoaded", function () {
        const sidebarItems = document.querySelectorAll('.menu-item')
        sidebarItems.forEach( i => {
            if (i.parentElement.pathname === window.location.pathname )
            {
                i.classList.add('current')
            }
        })
    })

    function scrollToTop() {
        window.scrollTo(0, 0);
    }
</script>
`;
