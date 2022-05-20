import http from 'http';

const PORT = 3000;

http
  .createServer(function (request, response) {
    if (request.method !== 'GET') {
      return response.end('Only GET requests are supported');
    }
    let url = new URL(request.url, `http://localhost:${PORT}`);
    let path = url.pathname.replace(/([^\/])$/, '$1/');
    if (path !== '/preview/') {
      return response.end('Only `/preview/` path is supported');
    }
    let searchParams = url.searchParams;
    let fileUrl = searchParams.get('url');
    let size = searchParams.get('size');
    console.log(`Got request. Url: "${fileUrl}". Size: "${size}"`);
    if (!fileUrl) {
      return response.end('`url` parameter is required');
    }
    response.statusCode = 302;
    response.setHeader('Location', fileUrl);
    response.end();
  })
  .listen(PORT);
