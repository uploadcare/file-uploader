export const uploader_build_cfg = [
  {
    in: './uploader/regular/index.js',
    out: './uploader/build/regular/index.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './uploader/regular/index.css',
    out: './uploader/build/regular/index.css',
    minify: false,
  },
  {
    in: './uploader/regular/index.css',
    out: './uploader/build/regular/index.min.css',
    minify: true,
  },
];
