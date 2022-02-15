export const upload_blocks_build_cfg = [
  {
    in: './upload-blocks/index.js',
    out: './upload-blocks/build/index.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './upload-blocks/index.js',
    out: './upload-blocks/build/index.js',
    minify: false,
    minifyHtml: false,
  },
  {
    in: './upload-blocks/themes/uc-basic/index.css',
    out: './upload-blocks/build/index.css',
    minify: false,
  },
  {
    in: './upload-blocks/themes/uc-basic/index.css',
    out: './upload-blocks/build/index.min.css',
    minify: true,
  },
];
