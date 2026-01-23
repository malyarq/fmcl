import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

export default defineConfig({
  optimizeDeps: {
    entries: [
      'index.html',
      'src/main.tsx',
    ],
  },
  server: {
    fs: {
      deny: ['**/research/**'],
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        // Keep Electron deps external to the renderer bundle.
        vite: {
          build: {
            rollupOptions: {
              external: [
                'electron',
                ...Object.keys(pkg.dependencies || {}),
              ],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: '[name].cjs',
              },
              external: [
                'electron',
                ...Object.keys(pkg.dependencies || {}),
              ],
            },
          },
        },
      },
      renderer: process.env.NODE_ENV === 'test'
        ? undefined
        : {},
    }),
  ],
})