import { Pen, setElemPosition } from '@topology/core';

export const echartsList: any = {};

export function echarts(pen: Pen): Path2D {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = resize;
    pen.onRotate = move;
  }

  const path = new Path2D();
  const worldRect = pen.calculative.worldRect;
  let echarts = echartsList.echarts;
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

  if (!echartsList[pen.id] || !echartsList[pen.id].div) {
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
    echartsList[pen.id] = {
      div,
      chart: echarts.init(div, (pen as any).echarts.theme),
    };

    // 3. 生产预览图
    // 初始化时，等待父div先渲染完成，避免初始图表控件太大。
    setTimeout(() => {
      echartsList[pen.id].chart.setOption((pen as any).echarts.option, true);
      echartsList[pen.id].chart.resize();
      setTimeout(() => {
        const img = new Image();
        img.src = echartsList[pen.id].chart.getDataURL({
          pixelRatio: 2,
        });
        pen.calculative.img = img;
      }, 100);
    });

    // 4. 加载到div layer
    pen.calculative.rootElement && pen.calculative.rootElement.appendChild(div);
    setElemPosition(pen, div);
  }

  path.rect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);

  if (pen.calculative.dirty && echartsList[pen.id]) {
    setElemPosition(pen, echartsList[pen.id].div);
  }
  return path;
}

function destory(pen: Pen) {
  echartsList[pen.id].div.remove();
  let echarts = echartsList.echarts;
  if (!echarts && window) {
    echarts = window['echarts'];
  }
  echarts && echarts.dispose(echartsList[pen.id].chart);
  echartsList[pen.id] = undefined;
}

function move(pen: Pen) {
  if (!echartsList[pen.id]) {
    return;
  }
  setElemPosition(pen, echartsList[pen.id].div);
}

function resize(pen: Pen) {
  if (!echartsList[pen.id]) {
    return;
  }
  setElemPosition(pen, echartsList[pen.id].div);
  echartsList[pen.id].chart.resize();
}
