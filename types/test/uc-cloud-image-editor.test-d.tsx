// @ts-expect-error - no props
() => <uc-cloud-image-editor />;

// @ts-expect-error - no css-url
() => <uc-cloud-image-editor ctx-name="my-uploader" />;

// @ts-expect-error - no css-src
() => <uc-cloud-image-editor css-src="url" />;

// TODO: css-src should throw an error, something wrong with the tests or types
() => <uc-cloud-image-editor ctx-name="my-editor" css-src="url" uuid="123124" />;
() => <uc-cloud-image-editor ctx-name="my-editor" css-src="url" uuid="123124" tabs="tab" crop-preset="preset" />;
() => <uc-cloud-image-editor ctx-name="my-editor" css-src="url" cdn-url="url" />;
