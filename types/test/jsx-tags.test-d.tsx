import '../jsx';
import React from 'react';

/** Blocks without their own `attributesMeta` take `ctx-name` and the common HTML attributes, nothing else. */

() => <uc-drop-area ctx-name="x" id="drop" hidden></uc-drop-area>;
() => <uc-upload-list ctx-name="x"></uc-upload-list>;
// Tags that were missing from the map.
() => <uc-spinner ctx-name="x"></uc-spinner>;
() => <uc-copyright ctx-name="x"></uc-copyright>;
() => <uc-thumb ctx-name="x"></uc-thumb>;

// @ts-expect-error missing ctx-name
() => <uc-drop-area></uc-drop-area>;
// @ts-expect-error unknown attribute
() => <uc-drop-area ctx-name="x" foo="bar"></uc-drop-area>;
// @ts-expect-error unknown attribute
() => <uc-modal ctx-name="x" open></uc-modal>;
