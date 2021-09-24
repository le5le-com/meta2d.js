import { Pen, setElemPosition } from '@topology/core';

export const echartsObjs: any = {};

export function echarts(pen: Pen): Path2D {
  const path = new Path2D();

  pen.onDestroy = destory;
  const worldRect = pen.calculative.worldRect;

  let echarts = echartsObjs.echarts;
  if (!echarts && window) {
    echarts = window['echarts'];
  }
  if (!(pen as any).echarts || !echarts) {
    return;
  }

  if (typeof (pen as any).echarts === 'string') {
    try {
      (pen as any).echarts = JSON.parse((pen as any).echarts);
    } catch {}
  }
  if (!(pen as any).echarts) {
    return;
  }

  if (!echartsObjs[pen.id] || !echartsObjs[pen.id].div) {
    // 1. 创建父容器
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.outline = 'none';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.width = worldRect.width + 'px';
    div.style.height = worldRect.height + 'px';
    document.body.appendChild(div);

    // 2. 创建echart
    echartsObjs[pen.id] = {
      div,
      chart: echarts.init(div, (pen as any).echarts.theme),
    };

    // 3. 生产预览图
    // 初始化时，等待父div先渲染完成，避免初始图表控件太大。
    setTimeout(() => {
      echartsObjs[pen.id].chart.setOption((pen as any).echarts.option, true);
      echartsObjs[pen.id].chart.resize();
      setTimeout(() => {
        const img = new Image();
        img.src = echartsObjs[pen.id].chart.getDataURL({
          pixelRatio: 2,
        });
        pen.calculative.img = img;
      }, 100);
    });

    // 4. 加载到div layer
    pen.calculative.rootElement.appendChild(div);
    setElemPosition(pen, div);
  }

  path.rect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);
  return path;
}

function destory(pen: Pen) {
  echartsObjs[pen.id].remove();
  echartsObjs[pen.id] = undefined;
}
