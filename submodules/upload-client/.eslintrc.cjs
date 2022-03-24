module.exports = {
  rules: {
    'prettier/prettier': 'error'
  },
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint', 'prettier'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier'
      ],
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        project: './tsconfig.json'
      },
      rules: {
        // this rule was disabled earlier, so I didn't update the code to match it
        '@typescript-eslint/explicit-module-boundary-types': 0
      }
    },
    {
      files: ['**/*.js'],
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module'
      },
      env: {
        node: true,
        commonjs: true
      }
    }
  ]
}
