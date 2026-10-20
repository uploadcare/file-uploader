import '../jsx';
import React from 'react';
import { test } from 'vitest';

test('<uc-cloud-image-editor> takes a uuid or a cdn-url, with optional tabs and crop-preset', () => {
  () => <uc-cloud-image-editor ctx-name="my-editor" uuid="123124" />;
  () => <uc-cloud-image-editor ctx-name="my-editor" uuid="123124" tabs="tab" crop-preset="preset" />;
  () => <uc-cloud-image-editor ctx-name="my-editor" cdn-url="url" />;
});

test('<uc-cloud-image-editor> rejects a render without an image or a ctx-name', () => {
  // @ts-expect-error no props
  () => <uc-cloud-image-editor />;
  // @ts-expect-error neither uuid nor cdn-url
  () => <uc-cloud-image-editor ctx-name="my-uploader" />;
  // @ts-expect-error css-src is not an attribute, and ctx-name is missing
  () => <uc-cloud-image-editor css-src="url" />;
});
