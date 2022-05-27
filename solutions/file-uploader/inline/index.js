import { FileUploaderInline } from './FileUploaderInline.js';
import * as LR from '../../../index.js';
LR.registerBlocks(LR);

class Uploader extends FileUploaderInline {}
Uploader.reg('uploader');
