import '../jsx';
import React from 'react';
import { test } from 'vitest';

/** Blocks without their own `attributesMeta` take `ctx-name` and the common HTML attributes, nothing else. */

test('a block without attributesMeta takes ctx-name and the common HTML attributes', () => {
  () => <uc-drop-area ctx-name="x" id="drop" hidden></uc-drop-area>;
  () => <uc-upload-list ctx-name="x"></uc-upload-list>;
});

test('the tags that were missing from the JSX map are typed', () => {
  () => <uc-spinner ctx-name="x"></uc-spinner>;
  () => <uc-copyright ctx-name="x"></uc-copyright>;
  () => <uc-thumb ctx-name="x"></uc-thumb>;
});

test('a block without attributesMeta rejects a missing ctx-name and unknown attributes', () => {
  // @ts-expect-error missing ctx-name
  () => <uc-drop-area></uc-drop-area>;
  // @ts-expect-error unknown attribute
  () => <uc-drop-area ctx-name="x" foo="bar"></uc-drop-area>;
  // @ts-expect-error unknown attribute
  () => <uc-modal ctx-name="x" open></uc-modal>;
});
