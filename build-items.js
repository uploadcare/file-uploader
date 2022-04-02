export const buildItems = [
  // BLOCKS
  {
    in: './index.js',
    out: './web/uc-blocks.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './blocks/themes/uc-basic/index.css',
    out: './web/themes/uc-basic.min.css',
    minify: true,
  },

  // CLOUD EDITOR
  {
    in: './blocks/CloudImageEditor/index.js',
    out: '~/web/solutions/uc-cloud-image-editor/index.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './blocks/CloudImageEditor/src/css/index.css',
    out: '~/web/solutions/uc-cloud-image-editor/index.min.css',
    minify: true,
  },

  // REGULAR FILE UPLOADER
  {
    in: './solutions/file-uploader/regular/index.js',
    out: '~/web/solutions/file-uploader/regular/index.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './solutions/file-uploader/regular/index.css',
    out: '~/web/solutions/file-uploader/regular/index.min.css',
    minify: true,
  },
];
