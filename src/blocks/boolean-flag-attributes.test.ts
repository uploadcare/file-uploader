import { describe, expect, it } from 'vitest';
import { FileUploaderRegular } from '../solutions/file-uploader/regular/FileUploaderRegular';
import { Uploader } from '../solutions/file-uploader/Uploader';
import { DropArea } from './DropArea/DropArea';
import { DynamicBtn } from './DynamicBtn/DynamicBtn';
import { SimpleBtn } from './SimpleBtn/SimpleBtn';
import { SourceBtn } from './SourceBtn/SourceBtn';

// Idempotent (same path as defineComponents(UC)).
FileUploaderRegular.reg('uc-file-uploader-regular');
Uploader.reg('uc-uploader');
DropArea.reg('uc-drop-area');
DynamicBtn.reg('uc-dynamic-btn');
SimpleBtn.reg('uc-simple-btn');
SourceBtn.reg('uc-source-btn');

// v1 read every block flag with Lit's `type: Boolean` (main: FileUploaderRegular.ts:32-36, DropArea.ts:21-43,
// SimpleBtn.ts:13, DynamicBtn.ts:60, SourceBtn.ts:22-25): presence means true whatever the value, "false" included,
// and the attribute stays on the host.
const FLAGS = [
  ['uc-file-uploader-regular', 'headless', 'headless'],
  ['uc-file-uploader-regular', 'dynamic-button', 'dynamicButton'],
  ['uc-uploader', 'headless', 'headless'],
  ['uc-uploader', 'dynamic-button', 'dynamicButton'],
  ['uc-simple-btn', 'dropzone', 'dropzone'],
  ['uc-dynamic-btn', 'dropzone', 'dropzone'],
  ['uc-source-btn', 'textonly', 'textOnly'],
  ['uc-source-btn', 'icononly', 'iconOnly'],
  ['uc-drop-area', 'single', 'single'],
  ['uc-drop-area', 'ghost', 'ghost'],
  ['uc-drop-area', 'disabled', 'disabled'],
  ['uc-drop-area', 'clickable', 'clickable'],
  ['uc-drop-area', 'with-icon', 'withIcon'],
  ['uc-drop-area', 'fullscreen', 'fullscreen'],
  ['uc-drop-area', 'initflow', 'initflow'],
] as const;

const readFlag = (el: HTMLElement, prop: string): unknown => Reflect.get(el, prop);

describe('block boolean attributes keep the v1 presence rule', () => {
  describe.each(FLAGS)('<%s %s>', (tag, attr, prop) => {
    it.each(['', 'true', 'false', '0', 'no', 'FALSE'])('reads %o as true and keeps the attribute', (value) => {
      const el = document.createElement(tag);
      el.setAttribute(attr, value);
      expect(readFlag(el, prop)).toBe(true);
      expect(el.getAttribute(attr)).toBe(value);
    });

    it('reads a removed attribute as false', () => {
      const el = document.createElement(tag);
      el.setAttribute(attr, 'false');
      el.removeAttribute(attr);
      expect(readFlag(el, prop)).toBe(false);
    });
  });
});
