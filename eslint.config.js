import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  { ignores: ['dist', 'dist-electron', 'release', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2020,
        Electron: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['useSettings', 'useModpack', 'useToast', 'useConfirm', 'getInstanceRamGb'] },
      ],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-empty': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-useless-escape': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // --- Architecture guardrails ---
  // Renderer must not import Electron/Node runtime modules.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            'electron',
            'fs',
            'node:fs',
            'path',
            'node:path',
            'os',
            'node:os',
            'child_process',
            'node:child_process',
            'crypto',
            'node:crypto',
            'net',
            'node:net',
            'tls',
            'node:tls',
          ],
          patterns: [
            {
              group: ['electron/*', 'electron/**', '../electron/*', '../electron/**', '../../electron/**'],
              message: 'Renderer (src/) must not import from electron/. Use window.* or src/services/ipc/*.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'ipcRenderer',
          message: 'Avoid raw window.ipcRenderer in renderer. Prefer src/services/ipc/* or typed window.* APIs.',
        },
      ],
    },
  },
  // Electron domain services must not depend on IPC/preload wiring.
  {
    files: ['electron/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../ipc/**', '../../ipc/**', '../preload/**', '../../preload/**'],
              message: 'electron/services must not import IPC or preload wiring (electron/ipc, electron/preload).',
            },
          ],
        },
      ],
    },
  },
];
