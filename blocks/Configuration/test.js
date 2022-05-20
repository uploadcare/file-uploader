import { Configuration } from './Configuration.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ Configuration });

const ucConfiguration = new Configuration();
ucConfiguration.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(ucConfiguration);
  ucConfiguration.setPreviewUrlCallback(
    (cdnUrl, fileInfo) => `https://domain.com/preview/?cdnUrl=${cdnUrl}&size=${fileInfo.size}`
  );

  let callback = ucConfiguration.$['*previewUrlCallback'];
  let fileInfo = { size: 1234 };
  // @ts-ignore
  console.log(`Callback result: ${callback('https://ucarecdn.com/:uuid/', fileInfo)}`);
};
