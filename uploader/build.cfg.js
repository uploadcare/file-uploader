export const buildCfg = [
  {
    in: './regular/index.js',
    out: './build/regular/index.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './regular/index.css',
    out: './build/regular/index.css',
    minify: false,
  },
  {
    in: './regular/index.css',
    out: './build/regular/index.min.css',
    minify: true,
  },
];
