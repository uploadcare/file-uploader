export const buildCfg = [
  {
    in: './index.js',
    out: './build/index.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './index.js',
    out: './build/index.js',
    minify: false,
    minifyHtml: false,
  },
  {
    in: './themes/uc-basic/index.css',
    out: './build/index.css',
    minify: false,
  },
  {
    in: './themes/uc-basic/index.css',
    out: './build/index.min.css',
    minify: true,
  },
];
