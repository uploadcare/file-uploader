module.exports = {
  extends: [
    // "stylelint-config-rational-order",
    'stylelint-config-standard',
    'stylelint-config-prettier',
  ],
  plugins: ['stylelint-declaration-block-no-ignored-properties'],
  rules: {
    'plugin/declaration-block-no-ignored-properties': true,
    'function-calc-no-unspaced-operator': null,
    'keyframes-name-pattern': null,
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'custom-property-empty-line-before': null,
    'length-zero-no-unit': null,
    'value-keyword-case': [
      'lower',
      {
        ignoreKeywords: ['currentColor'],
      },
    ],
  },
  overrides: [
    {
      files: ['blocks/**/*.css', 'solutions/**/*.css'],
      ignoreFiles: ['**/test/**/*.css'],
      plugins: ['./stylelint-force-app-name-prefix.cjs'],
      rules: {
        'plugin/stylelint-force-app-name-prefix': {
          appName: 'uc',
        },
      },
    },
  ],
};
