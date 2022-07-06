import { FileUploaderMinimal } from './FileUploaderMinimal.js';
import * as LR from '../../../index.js';
LR.registerBlocks(LR);

class Uploader extends FileUploaderMinimal {}
Uploader.reg('uploader');
