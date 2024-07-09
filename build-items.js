// @ts-check

/** @typedef {{ in: string; out: string; minify: boolean; minifyHtml?: boolean; iife?: boolean }} BuildItem */

/** @type {BuildItem[]} */
export const buildItems = [
  // uc-blocks
  {
    in: './index.js',
    out: './web/blocks.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './index.js',
    out: './web/blocks.iife.min.js',
    minify: true,
    minifyHtml: true,
    iife: true,
  },
  {
    in: './blocks/themes/uc-basic/index.css',
    out: './web/uc-basic.min.css',
    minify: true,
  },
  // uc-cloud-image-editor
  {
    in: './solutions/cloud-image-editor/index.js',
    out: './web/uc-cloud-image-editor.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './solutions/cloud-image-editor/index.css',
    out: './web/uc-cloud-image-editor.min.css',
    minify: true,
  },

  // file-uploader-regular
  {
    in: './solutions/file-uploader/regular/index.js',
    out: './web/uc-file-uploader-regular.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './solutions/file-uploader/regular/index.css',
    out: './web/uc-file-uploader-regular.min.css',
    minify: true,
  },

  // file-uploader-inline
  {
    in: './solutions/file-uploader/inline/index.js',
    out: './web/uc-file-uploader-inline.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './solutions/file-uploader/inline/index.css',
    out: './web/uc-file-uploader-inline.min.css',
    minify: true,
  },

  // file-uploader-minimal
  {
    in: './solutions/file-uploader/minimal/index.js',
    out: './web/uc-file-uploader-minimal.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './solutions/file-uploader/minimal/index.css',
    out: './web/uc-file-uploader-minimal.min.css',
    minify: true,
  },

  // uc-img
  {
    in: './solutions/adaptive-image/index.js',
    out: './web/uc-img.min.js',
    minify: true,
    minifyHtml: true,
  },

  // @TODO eadidenko, Delete after a few releases
  // Legacy
  {
    in: './blocks/themes/uc-basic/index.css',
    out: './web/lr-basic.min.css',
    minify: true,
  },
  // uc-cloud-image-editor
  {
    in: './solutions/cloud-image-editor/index.js',
    out: './web/lr-cloud-image-editor.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './solutions/cloud-image-editor/index.css',
    out: './web/lr-cloud-image-editor.min.css',
    minify: true,
  },

  // file-uploader-regular
  {
    in: './solutions/file-uploader/regular/index.js',
    out: './web/lr-file-uploader-regular.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './solutions/file-uploader/regular/index.css',
    out: './web/lr-file-uploader-regular.min.css',
    minify: true,
  },

  // file-uploader-inline
  {
    in: './solutions/file-uploader/inline/index.js',
    out: './web/lr-file-uploader-inline.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './solutions/file-uploader/inline/index.css',
    out: './web/lr-file-uploader-inline.min.css',
    minify: true,
  },

  // file-uploader-minimal
  {
    in: './solutions/file-uploader/minimal/index.js',
    out: './web/lr-file-uploader-minimal.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './solutions/file-uploader/minimal/index.css',
    out: './web/lr-file-uploader-minimal.min.css',
    minify: true,
  },

  // uc-img
  {
    in: './solutions/adaptive-image/index.js',
    out: './web/lr-img.min.js',
    minify: true,
    minifyHtml: true,
  },
];
