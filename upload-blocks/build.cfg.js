export const upload_blocks_build_cfg = [
  {
    in: './upload-blocks/index.js',
    out: './upload-blocks/build/upload-blocks.js',
    minifyHtml: true,
  },
  {
    in: './upload-blocks/themes/uc-basic/index.css',
    out: './upload-blocks/build/uc-basic.css',
  },
];

export const upload_blocks_build_cfg_ROLLUP = {
  input: './upload-blocks/index.js',
  output: [
    {
      file: './upload-blocks/build/upload-blocks.jsdoc.js',
      format: 'esm',
    },
  ],
};
