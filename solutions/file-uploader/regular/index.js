import * as UC from '../../../index.js';

UC.registerBlocks(UC);

class Uploader extends UC.FileUploaderRegular {}
Uploader.reg('uploader');
