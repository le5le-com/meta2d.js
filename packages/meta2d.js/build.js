/**
 * 独立构建脚本 - 为每个图库单独打包，避免生成共享 chunks
 */

import { build } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 基础配置
const baseConfig = {
  base: './',
  build: {
    outDir: resolve(__dirname, '../../dist/meta2d.js'),
    emptyOutDir: false, // 不清空，因为要多次构建
    sourcemap: true,
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
    target: 'es2015',
    chunkSizeWarningLimit: 5000,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    alias: {
      '@meta2d/core': resolve(__dirname, '../core'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
    'process': '{}',
  },
};

// 构建配置列表
const builds = [
  {
    name: 'meta2d.min',
    entry: resolve(__dirname, 'index.ts'),
    description: '核心引擎',
    format: 'umd',
    globalName: 'Meta2d',
  },
  {
    name: 'meta2d_echarts',
    entry: resolve(__dirname, 'entries/echarts.ts'),
    description: 'ECharts 扩展',
    format: 'es', // 改为 ES 模块
  },
  {
    name: 'meta2d_uml',
    entry: resolve(__dirname, 'entries/uml.ts'),
    description: 'UML 图元',
    format: 'es', // 改为 ES 模块
  },
  {
    name: 'meta2d_form',
    entry: resolve(__dirname, 'entries/form.ts'),
    description: '表单组件',
    format: 'es', // 改为 ES 模块
  },
  {
    name: 'meta2d_chart',
    entry: resolve(__dirname, 'entries/chart.ts'),
    description: '图表组件',
    format: 'es', // 改为 ES 模块
  },
  {
    name: 'meta2d_fta',
    entry: resolve(__dirname, 'entries/fta.ts'),
    description: '故障树分析',
    format: 'es', // 改为 ES 模块
  },
];

async function buildAll() {
  console.log('🚀 开始独立构建各图库...\n');

  // 第一次构建清空目录
  let isFirst = true;

  for (const config of builds) {
    console.log(`📦 正在构建: ${config.description} (${config.name}.js)`);

    try {
      const buildConfig = {
        ...baseConfig,
        build: {
          ...baseConfig.build,
          emptyOutDir: isFirst, // 只在第一次清空
          rollupOptions: {
            external: [],
            output: {
              exports: 'named',
              inlineDynamicImports: true, // 关键：内联所有动态导入
              entryFileNames: `${config.name}.js`,
            },
          },
        },
      };

      // 主文件使用 lib 模式（UMD）
      if (config.format === 'umd') {
        buildConfig.build.lib = {
          entry: config.entry,
          formats: ['umd'],
          name: config.globalName,
          fileName: () => config.name,
        };
      } else {
        // 图库使用 ES 模块格式
        buildConfig.build.lib = {
          entry: config.entry,
          formats: ['es'],
          fileName: () => config.name,
        };
      }

      await build(buildConfig);

      console.log(`✅ ${config.name}.js 构建完成\n`);
      isFirst = false;
    } catch (error) {
      console.error(`❌ ${config.name} 构建失败:`, error);
      process.exit(1);
    }
  }

  console.log('🎉 所有文件构建完成！');
  console.log('\n📁 输出目录: ../../dist/meta2d.js/');

  // 复制发包文件
  console.log('\n📋 复制发包文件...');
  const fs = await import('fs');
  const outDir = resolve(__dirname, '../../dist/meta2d.js');

  // 复制 package.json
  const packageJson = JSON.parse(
    fs.readFileSync(resolve(__dirname, 'package.publish.json'), 'utf-8')
  );
  fs.writeFileSync(
    resolve(outDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  console.log('✅ package.json 已复制');

  // 复制 README.md
  fs.copyFileSync(
    resolve(__dirname, 'README.publish.md'),
    resolve(outDir, 'README.md')
  );
  console.log('✅ README.md 已复制');

  console.log('\n✨ 发包准备完成！可以运行: cd dist/meta2d.js && npm publish');
}

buildAll().catch((error) => {
  console.error('构建失败:', error);
  process.exit(1);
});
