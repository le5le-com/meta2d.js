import { Pen, setElemPosition } from '@topology/core';

export const highchartsList: any = {};

export function highcharts(pen: Pen): Path2D {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = resize;
    pen.onRotate = move;
    pen.onValue = value;
  }

  const path = new Path2D();
  const worldRect = pen.calculative.worldRect;
  let highcharts = highchartsList.highcharts;
  if (!highcharts && window) {
    highcharts = window['Highcharts'];
  }
  if (!(pen as any).highcharts || !highcharts) {
    return;
  }

  if (typeof (pen as any).highcharts === 'string') {
    try {
      (pen as any).highcharts = JSON.parse((pen as any).highcharts.option);
    } catch {}
  }
  if (!(pen as any).highcharts) {
    return;
  }

  if (!highchartsList[pen.id] || !highchartsList[pen.id].div) {
    // 1. 创建父容器
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.outline = 'none';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.width = worldRect.width + 'px';
    div.style.height = worldRect.height + 'px';
    div.style.minWidth = '100px';
    div.style.minHeight = '100px';

    div.id = pen.id;
    document.body.appendChild(div);

    highchartsList[pen.id] = {
      div,
      chart: highcharts,
    };
    setTimeout(() => {
      highchartsList[pen.id].chart.chart(
        pen.id,
        (pen as any).highcharts.option
      );
    });

    // 4. 加载到div layer
    pen.calculative.canvas.externalElements &&
      pen.calculative.canvas.externalElements.appendChild(div);
    setElemPosition(pen, div);
  }

  path.rect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);

  if (pen.calculative.dirty && highchartsList[pen.id]) {
    setElemPosition(pen, highchartsList[pen.id].div);
  }
  return path;
}

function destory(pen: Pen) {
  highchartsList[pen.id].div.remove();
  let highcharts = highchartsList.highcharts;
  if (!highcharts && window) {
    highcharts = window['highcharts'];
  }
  highcharts && highcharts.dispose(highchartsList[pen.id].chart);
  highchartsList[pen.id] = undefined;
}

function move(pen: Pen) {
  if (!highchartsList[pen.id]) {
    return;
  }
  setElemPosition(pen, highchartsList[pen.id].div);
}

function resize(pen: Pen) {
  if (!highchartsList[pen.id]) {
    return;
  }
  setElemPosition(pen, highchartsList[pen.id].div);
  const chart = highchartsList[pen.id].chart.chart(
    pen.id,
    (pen as any).highcharts.option
  );
  chart.reflow();
}

function value(pen: Pen) {
  if (!highchartsList[pen.id]) {
    return;
  }
  // setElemPosition(pen, highchartsList[pen.id].div);
  const chart = highchartsList[pen.id].chart.chart(
    pen.id,
    (pen as any).highcharts.option
  );
  chart.reflow();
}
