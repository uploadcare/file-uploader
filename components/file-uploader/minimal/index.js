import { registerBlocks } from '../../../abstract/registerBlocks.js';
import { FileUploaderMinimal } from './FileUploaderMinimal.js';
import { StartFrom } from '../../../blocks/StartFrom/StartFrom.js';
import { DropArea } from '../../../blocks/DropArea/DropArea.js';
import { UploadList } from '../../../blocks/UploadList/UploadList.js';
import { FileItem } from '../../../blocks/FileItem/FileItem.js';
import { Icon } from '../../../blocks/Icon/Icon.js';
import { ProgressBar } from '../../../blocks/ProgressBar/ProgressBar.js';
import { MessageBox } from '../../../blocks/MessageBox/MessageBox.js';
import { LR_WINDOW_KEY } from '../../../abstract/connectBlocksFrom.js';

registerBlocks({
  FileUploaderMinimal,
  StartFrom,
  DropArea,
  UploadList,
  FileItem,
  Icon,
  ProgressBar,
  MessageBox,
});
