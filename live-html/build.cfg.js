export const live_html_build_cfg = [
  {
    in: './live-html/index.js',
    out: './live-html/build/index.min.js',
    minifyHtml: true,
  },
];

export const live_html_build_cfg_ROLLUP = {
  input: './live-html/index.js',
  output: [
    {
      file: './live-html/build/index.jsdoc.js',
      format: 'esm',
    },
  ],
};
