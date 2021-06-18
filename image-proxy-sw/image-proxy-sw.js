import { registerSw, registerHandler } from '../sw-manager/sw-manager.js';

const swKey = '';

registerHandler('fetch', 'uc-ad-id', async (e, ctx, shared) => {
  if (e.request.destination !== 'image') {
    return;
  }
  let newRequestInit = {
    method: 'GET',
  };
  let urlArr = e.request.url.split('?');
  if (!urlArr[1]) {
    urlArr.push('');
  }
  if (!urlArr[1].includes('format/auto') && e.request.headers.get('Accept').includes('image/webp')) {
    urlArr[1] += '-/format/webp/';
  }
  let url = new URL(`https://f1489c76e8e4cd7d9780.ucr.io/${(urlArr[1] || '') + urlArr[0]}`);
  // console.log(url.href)
  let newRequest = new Request(url.toString(), new Request(e.request, newRequestInit));
  try {
    if (e.request.url.includes('localhost') || e.request.url.includes('ucarecdn.com')) {
      return await fetch(e.request);
    }
    return await fetch(newRequest);
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e.message,
      }),
      {
        status: 500,
      }
    );
  }
}, swKey);
