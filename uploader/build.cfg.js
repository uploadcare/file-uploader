export const uploader_build_cfg = [
  {
    in: './uploader/regular/index.js',
    out: './uploader/build/regular/uc-uploader.min.js',
    minifyHtml: true,
  },
  {
    in: './uploader/regular/index.css',
    out: './uploader/build/regular/uc-uploader.css',
  },
];

export const uploader_build_cfg_ROLLUP = {
  input: './uploader/regular/index.js',
  output: [
    {
      file: './uploader/build/regular/uc-uploader.jsdoc.js',
      format: 'esm',
    },
  ],
};
