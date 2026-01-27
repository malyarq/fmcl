import { defineConfig } from 'vite';
import path from 'node:path';
import electron from 'vite-plugin-electron/simple';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

const sharedAlias = {
  '@shared': path.resolve(__dirname, 'shared')
};
export default defineConfig({
  resolve: {
    alias: sharedAlias
  },
  optimizeDeps: {
    entries: ['index.html', 'src/main.tsx']
  },
  server: {
    fs: {
      deny: ['**/research/**']
    },
    watch: {
      // Prevent dev server reload loops when build artifacts change (e.g. after `npm run build` / electron-builder).
      ignored: ['**/release/**', '**/dist/**', '**/dist-electron/**']
    }
  },
  plugins: [react(), electron({
    main: {
      entry: 'electron/main.ts',
      // Keep Electron deps external to the renderer bundle.
      vite: {
        resolve: {
          alias: sharedAlias
        },
        build: {
          rollupOptions: {
            external: ['electron', ...Object.keys(pkg.dependencies || {})]
          }
        }
      }
    },
    preload: {
      input: path.join(__dirname, 'electron/preload.ts'),
      vite: {
        resolve: {
          alias: sharedAlias
        },
        build: {
          rollupOptions: {
            output: {
              format: 'cjs',
              entryFileNames: '[name].cjs'
            },
            external: ['electron', ...Object.keys(pkg.dependencies || {})]
          }
        }
      }
    },
    renderer: {}
  })]
});
