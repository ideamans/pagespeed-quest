// ESLint 9 以降の flat config。旧 .eslintrc.json の規則をそのまま移した
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { importX } from 'eslint-plugin-import-x'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules', 'build', 'coverage'] },
  js.configs.recommended,
  eslintComments.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['src/**/*.ts'],
    plugins: { 'import-x': importX },
    languageOptions: {
      parserOptions: { project: './tsconfig.json' },
      globals: { BigInt: true, console: true, WebAssembly: true },
    },
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@eslint-community/eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
      '@eslint-community/eslint-comments/no-unused-disable': 'error',
      'import-x/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
      'sort-imports': ['error', { ignoreDeclarationSort: true, ignoreCase: true }],
    },
  }
)
