const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: ['out/**', 'dist/**', '**/*.d.ts', 'media/**/*.js'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/naming-convention': [
        'warn',
        // The rule's documented defaults, restated because supplying any
        // options replaces them entirely
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        // Keys that must be quoted (spaces, dots) are literal data — VS Code
        // dialog filter names, file extensions, config keys — not identifiers
        { selector: 'objectLiteralProperty', modifiers: ['requiresQuotes'], format: null },
      ],
      curly: 'warn',
      eqeqeq: 'warn',
      'no-throw-literal': 'warn',
      semi: 'off',
    },
  },
];
