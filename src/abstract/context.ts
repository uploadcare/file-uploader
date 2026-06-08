import { createContext } from '@lit/context';
import type { UploaderController } from '../abstract/controllers/UploaderController';

export const uploaderContext = createContext<UploaderController>(Symbol('uc-uploader'));
