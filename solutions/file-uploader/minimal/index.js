import { FileUploaderMinimal } from './FileUploaderMinimal.js';
import * as UC from '../../../index.js';
UC.registerBlocks(UC);

class Uploader extends FileUploaderMinimal {}
Uploader.reg('uploader');
