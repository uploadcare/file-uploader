export const buildCfg = [
  {
    in: './src/index.js',
    out: './build/index.min.js',
    minify: true,
    minifyHtml: true,
    includeExternals: true,
  },
  {
    in: './src/index.js',
    out: './build/index.js',
    minify: false,
    minifyHtml: false,
    includeExternals: false,
  },
  {
    in: './src/index.css',
    out: './build/index.css',
    minify: false,
  },
];
