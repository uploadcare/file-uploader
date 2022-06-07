import * as LR from '../../../index.js';

LR.registerBlocks(LR);

class Uploader extends LR.FileUploaderRegular {}
Uploader.reg('uploader');
