import * as UC from '../../../blocks/index.js';

UC.registerBlocks(UC);

class Uploader extends UC.FileUploaderRegular {}
Uploader.reg('uploader');
