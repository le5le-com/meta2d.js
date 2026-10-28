/**
 * Meta2d.js 分包入口
 *
 * 核心引擎入口，图库通过独立文件按需加载
 * 引入脚本后自动注册 Web Component
 */

// 导出 core 的所有内容
export * from '@meta2d/core';

// 导入核心
import { Meta2d, createMeta2d } from '@meta2d/core';

// 自动初始化：注册 Web Component
if (typeof window !== 'undefined') {
  createMeta2d('le5le-meta2d');
}

// 显式导出核心 API（便于使用）
export { Meta2d, createMeta2d };


