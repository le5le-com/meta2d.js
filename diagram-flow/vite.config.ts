import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import * as path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'le5le-meta2d',
        },
      },
    }),
    vueJsx(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/'),
      '@meta2d': path.resolve(__dirname, '../packages'),
      // 本地开发时把动态加载的'/npm/包'映射到源码
      '/npm/': path.resolve('../packages') + '/',
    },
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        // 生产环境：把需要动态加载的npm包单独chunk
        chunkFileNames: ({ name }) => {
          if (name === '@meta2d/echarts') {
            return 'npm/@meta2d_echarts.js'; // 固定名
          } else if (name === '@meta2d/uml') {
            return 'npm/@meta2d_uml.js'; // 固定名
          }
          // 其余保持默认
          return '[name]-[hash].js';
        },
        manualChunks(id) {
          if (id.includes('packages/echarts')) {
            return '@meta2d/echarts';
          } else if (id.includes('packages/uml')) {
            return '@meta2d/uml';
          }
        },
      },
    },
  },
});
