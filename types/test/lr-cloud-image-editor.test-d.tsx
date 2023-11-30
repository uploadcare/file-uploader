// @ts-expect-error - no props
() => <lr-cloud-image-editor />;

// @ts-expect-error - no css-url
() => <lr-cloud-image-editor ctx-name="my-uploader" />;

// @ts-expect-error - no css-src
() => <lr-cloud-image-editor css-src="url" />;

() => <lr-cloud-image-editor ctx-name="my-editor" css-src="url" uuid="123124" />;
() => <lr-cloud-image-editor ctx-name="my-editor" css-src="url" uuid="123124" tabs="tab" crop-preset="preset" />;
() => <lr-cloud-image-editor ctx-name="my-editor" css-src="url" cdn-url="url" />;
