import { ShadowWrapper } from '../blocks/ShadowWrapper/ShadowWrapper.js';
import { uploaderBlockCtx } from './CTX.js';

export class SolutionBlock extends ShadowWrapper {
  ctxInit = uploaderBlockCtx(this);
  ctxOwner = true;
}
