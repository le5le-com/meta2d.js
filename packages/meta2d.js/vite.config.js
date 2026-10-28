import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    // 构建为库模式
    lib: {
      entry: {
        // 主入口：核心引擎 + 所有图库
        'meta2d.min': resolve(__dirname, 'index.ts'),
        // 各图库独立入口
        'meta2d_echarts': resolve(__dirname, 'entries/echarts.ts'),
        'meta2d_uml': resolve(__dirname, 'entries/uml.ts'),
        'meta2d_form': resolve(__dirname, 'entries/form.ts'),
        'meta2d_chart': resolve(__dirname, 'entries/chart.ts'),
        'meta2d_fta': resolve(__dirname, 'entries/fta.ts'),
      },
      formats: ['es'], // 使用 ES 模块格式支持代码分割
    },

    // 输出目录
    outDir: '../../dist/meta2d.js',
    emptyOutDir: true,

    // Rollup 选项
    rollupOptions: {
      external: [],
      output: {
        exports: 'named',
        assetFileNames: '[name][extname]',
        chunkFileNames: '[name].js',
        entryFileNames: '[name].js',
      },
    },

    // 源码映射
    sourcemap: true,

    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        pure_funcs: ['console.log'],
      },
      format: {
        comments: false,
      },
    },

    // 目标环境
    target: 'es2015',

    // chunk 大小警告阈值
    chunkSizeWarningLimit: 5000,

    // 关闭 CSS 代码分割
    cssCodeSplit: false,

    // 关闭资源内联限制
    assetsInlineLimit: 100000000,
  },

  // Worker 配置 - 固定名称
  worker: {
    format: 'es',
    plugins: () => [],
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: (chunkInfo) => {
          const id = chunkInfo.facadeModuleId || '';

          if (id.includes('workers/render')) return 'meta2d.render.worker.js';
          if (id.includes('workers/calc')) return 'meta2d.calc.worker.js';
          if (id.includes('workers/hover')) return 'meta2d.hover.worker.js';
          if (id.includes('workers/utility')) return 'meta2d.utility.worker.js';

          return `meta2d.${chunkInfo.name}.worker.js`;
        },
      },
    },
  },

  // 开发服务器配置
  server: {
    port: 3000,
    open: '/test.html',
  },

  // 解析配置
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    alias: {
      '@meta2d/core': resolve(__dirname, '../core'),
    },
  },

  // 优化配置
  optimizeDeps: {
    include: ['@meta2d/core'],
  },

  // 定义全局常量
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
    'process': '{}',
  },
});
