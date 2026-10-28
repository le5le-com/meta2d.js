/**
 * Meta2d ECharts 扩展独立入口
 * 需要先加载 meta2d.min.js
 */

import { penDefines } from '@meta2d/echarts';

// 自动注册函数
function autoRegister() {
  const meta2dElements = document.querySelectorAll('le5le-meta2d');
  if (meta2dElements.length > 0) {
    meta2dElements.forEach((el: any) => {
      if (el && el.registerElement && penDefines) {
        el.registerElement(penDefines);
        console.log('[Meta2d ECharts] 已注册 ECharts 图元');
      }
    });
  }
}

// 立即尝试注册
if (typeof window !== 'undefined') {
  autoRegister();

  // 如果 DOM 还未加载完成，等待 DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoRegister);
  }
}

export { penDefines };
