import { defineConfig } from "vite";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    fs: {
      allow: [
        // 允许访问项目根目录
        path.resolve(__dirname, "."),
        // 允许访问 meta2d.js 包目录
        path.resolve(__dirname, "../../"),
        // 允许开发环境加载 components 图库源码
      ],
    },
    proxy: {
      '/api': 'http://v.le5le.com',
      '/png': 'https://assets.le5lecdn.com/',
      '/svg': 'https://assets.le5lecdn.com/',

      png: 'https://assets.le5lecdn.com/',
      '/v/material': 'https://assets.le5lecdn.com/',
      '/2023': 'https://drive.le5lecdn.com/',
      '/2025': 'https://drive.le5lecdn.com/',
      '/2024': 'https://drive.le5lecdn.com/',
    },
    port: 3030,
    open: true,
  },
  resolve: {
    alias: {
      "@meta2d": path.resolve(__dirname, "../../packages"),
      '/npm/': path.resolve(__dirname, '../../packages') + '/',
    },
  },
  // optimizeDeps: {
  //   exclude: ["@meta2d/core"],
  //   include: [
  //     '@meta2d/core > @lvcabral/upng', // 显式预构建这个 CJS 依赖
  //     // 如果还有其他 CJS 间接依赖报类似错误，继续加
  //     // '@meta2d/core > some-other-cjs-dep',
  //      '@meta2d/core > gifuct-js', // 新增
  //   ],
  // },
});
