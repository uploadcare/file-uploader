import { FileUploaderInline } from './FileUploaderInline.js';
import * as UC from '../../../index.js';
UC.registerBlocks(UC);

class Uploader extends FileUploaderInline {}
Uploader.reg('uploader');
