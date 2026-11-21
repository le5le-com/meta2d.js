import { defineConfig } from 'vite';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // 直接跑仓库里的源码，不走 npm 上的旧版本
      '@meta2d/core': path.resolve(__dirname, '../../packages/core/index.ts'),
    },
  },
  server: {
    port: 3040,
  },
});
