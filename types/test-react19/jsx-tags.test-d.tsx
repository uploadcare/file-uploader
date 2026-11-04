import '../jsx';
import { test } from 'vitest';

// React 19 reads JSX types from `React.JSX` only, not the global `JSX` namespace React 18 also read.

test('the uploader tags are typed under React 19', () => {
  () => <uc-file-uploader-regular ctx-name="x"></uc-file-uploader-regular>;
  () => <uc-config ctx-name="x" pubkey="demopublickey"></uc-config>;
});

test('React 19 still rejects a missing ctx-name and unknown attributes', () => {
  // @ts-expect-error missing ctx-name
  () => <uc-drop-area></uc-drop-area>;
  // @ts-expect-error unknown attribute
  () => <uc-drop-area ctx-name="x" foo="bar"></uc-drop-area>;
});
