module.exports = {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-order', 'stylelint-declaration-block-no-ignored-properties'],
  rules: {
    'plugin/declaration-block-no-ignored-properties': true,
    'function-calc-no-unspaced-operator': true, // can cause out of memory in some cases
    'keyframes-name-pattern': null,
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'custom-property-empty-line-before': null,
    'length-zero-no-unit': null,
    'no-descending-specificity': null,
    'value-keyword-case': [
      'lower',
      {
        ignoreKeywords: ['currentColor'],
      },
    ],
    'color-function-notation': null,
    'order/order': ['custom-properties', 'declarations'],
    'order/properties-order': ['width', 'height'],
    'rule-empty-line-before': null,
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['container'],
      },
    ],
    'property-no-unknown': [
      true,
      {
        ignoreProperties: ['container-type', 'container-name'],
      },
    ],
    'media-feature-range-notation': null,
  },
  overrides: [
    {
      files: ['blocks/**/*.css', 'solutions/**/*.css'],
      ignoreFiles: ['**/test/**/*.css'],
      plugins: ['./stylelint-force-app-name-prefix.cjs'],
      rules: {
        // 'plugin/stylelint-force-app-name-prefix': {
        //   appName: 'lr',
        // },
      },
    },
  ],
};
