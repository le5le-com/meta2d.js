/**
 * Meta2d UML 扩展独立入口
 * 需要先加载 meta2d.min.js
 */

import { penDefines } from '@meta2d/uml';

// 暴露到全局变量，方便手动注册
if (typeof window !== 'undefined') {
  (window as any).Meta2dUmlPens = penDefines;
}

// 自动注册函数
function autoRegister() {
  const meta2dElements = document.querySelectorAll('le5le-meta2d');
  if (meta2dElements.length > 0) {
    meta2dElements.forEach((el: any) => {
      if (el && el.registerElement && penDefines) {
        el.registerElement(penDefines);
        console.log('[Meta2d UML] 已自动注册 UML 图元');
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
