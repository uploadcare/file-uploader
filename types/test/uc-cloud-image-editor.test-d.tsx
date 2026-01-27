import '../jsx';
import React from 'react';

// @ts-expect-error - no props
() => <uc-cloud-image-editor />;

// @ts-expect-error - no cdn-url
() => <uc-cloud-image-editor ctx-name="my-uploader" />;

// @ts-expect-error - no css-src
() => <uc-cloud-image-editor css-src="url" />;

() => <uc-cloud-image-editor ctx-name="my-editor" uuid="123124" />;
() => <uc-cloud-image-editor ctx-name="my-editor" uuid="123124" tabs="tab" crop-preset="preset" />;
() => <uc-cloud-image-editor ctx-name="my-editor" cdn-url="url" />;
