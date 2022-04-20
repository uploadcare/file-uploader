export const buildItems = [
  // uc-blocks
  {
    in: './index.js',
    out: './web/uc-blocks.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './blocks/themes/uc-basic/index.css',
    out: './web/uc-basic.min.css',
    minify: true,
  },

  // uc-cloud-image-editor
  {
    in: './blocks/CloudImageEditor/index.js',
    out: './web/uc-cloud-image-editor.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './blocks/CloudImageEditor/src/css/index.css',
    out: './web/uc-cloud-image-editor.min.css',
    minify: true,
  },

  // file-uploader-regular
  {
    in: './solutions/file-uploader/regular/index.js',
    out: './web/file-uploader-regular.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './solutions/file-uploader/regular/index.css',
    out: './web/file-uploader-regular.min.css',
    minify: true,
  },

  // file-uploader-minimal
  {
    in: './solutions/file-uploader/minimal/index.js',
    out: './web/file-uploader-minimal.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './solutions/file-uploader/minimal/index.css',
    out: './web/file-uploader-minimal.min.css',
    minify: true,
  },

  // uc-img
  {
    in: './solutions/adaptive-image/index.js',
    out: './web/uc-img.min.js',
    minify: true,
    minifyHtml: true,
  },
];
