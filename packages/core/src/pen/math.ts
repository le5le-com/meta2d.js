import { PenType } from '.';
import { Point } from '../point';
import {
  calcCenter,
  expandRect,
  Rect,
  rectInFourAngRect,
  rectToPoints,
} from '../rect';
import { Meta2dStore } from '../store';
import { deepClone } from '../utils';
import { Pen } from './model';

export function calcAnchorDock(
  store: Meta2dStore,
  e: Point,
  curAnchor?: Point
) {
  let xDock: Point;
  let yDock: Point;
  let x = Infinity;
  let y = Infinity;
  const size = 8;
  for (const pen of store.data.pens) {
    if (pen.calculative.inView === false) {
      continue;
    }

    // 得到图形的全部点
    const points = getPointsByPen(pen);
    points.forEach((pt) => {
      if (pt === e || pt === curAnchor) {
        return;
      }
      let distance =
        (pen.calculative.worldRect.center.x - e.x) *
          (pen.calculative.worldRect.center.x - e.x) +
        (pen.calculative.worldRect.center.y - e.y) *
          (pen.calculative.worldRect.center.y - e.y);
      const disX = Math.abs(pt.x - e.x);
      if (disX > 0 && disX < size && distance < x) {
        xDock = {
          x: Math.round(pt.x) + 0.5,
          y: Math.round(pt.y) + 0.5,
          prev: {
            x: Math.round(e.x) + 0.5,
            y: Math.round(e.y) + 0.5,
          },
          step: pt.x - e.x,
        };
        x = distance;
      }
      const disY = Math.abs(pt.y - e.y);
      if (disY > 0 && disY < size && distance < y) {
        yDock = {
          x: Math.round(pt.x) + 0.5,
          y: Math.round(pt.y) + 0.5,
          prev: {
            x: Math.round(e.x) + 0.5,
            y: Math.round(e.y) + 0.5,
          },
          step: pt.y - e.y,
        };
        y = distance;
      }
    });
  }

  return {
    xDock,
    yDock,
  };
}

export function calcMoveDock(
  store: Meta2dStore,
  rect: Rect,
  pens: Pen[],
  offset: Point
) {
  // 找到 points ，深拷贝一下，不影响原值
  let activePoints: Point[] = [];
  if (pens.length === 1) {
    activePoints = deepClone(getPointsByPen(pens[0]));
    activePoints.forEach((point) => {
      point.x += offset.x;
      point.y += offset.y;
    });
  } else {
    calcCenter(rect);
    activePoints = [rect.center, ...rectToPoints(rect)];
  }
  return calcDockByPoints(store, activePoints, rect, true);
}

/**
 * 得到画笔的全部点
 * 线 即全部的 worldAnchors
 * 图形 即全部的 worldAnchors ，加上边缘四个点以及中心点
 * @param pen 画笔
 */
export function getPointsByPen(pen: Pen): Point[] {
  if (!pen.type) {
    const outerPoints = rectToPoints(pen.calculative.worldRect);
    calcCenter(pen.calculative.worldRect);
    return [
      ...pen.calculative.worldAnchors,
      ...outerPoints,
      pen.calculative.worldRect.center,
    ];
  } else if (pen.type === PenType.Line) {
    return pen.calculative.worldAnchors;
  }
}

export function calcResizeDock(
  store: Meta2dStore,
  rect: Rect,
  pens: Pen[],
  resizeIndex: number
): { xDock: Point; yDock: Point } {
  const activePoints = rectToPoints(rect);
  return calcDockByPoints(store, activePoints, rect);
}

/**
 * 通过当前 活动层 的所有点 计算 dock
 * @param activePoints 活动层 的所有点
 * @param rect 当前区域
 * @param calcActive 是否与 活动层画笔 的点进行计算
 */
function calcDockByPoints(
  store: Meta2dStore,
  activePoints: Point[],
  rect: Rect,
  calcActive = false
): { xDock: Point; yDock: Point } {
  let xDock: Point;
  let yDock: Point;
  let minCloseX = Infinity;
  let minCloseY = Infinity;

  // 临近范围
  const closeSize = 10;
  const paddingRect = expandRect(rect, closeSize);
  store.data.pens.forEach((pen) => {
    const { inView, worldRect, active } = pen.calculative;
    if (
      inView === false ||
      (!calcActive && active) || // 如果不计算活动层，则过滤掉活动层
      rectInFourAngRect(paddingRect, worldRect) || // 水平和垂直方向 无重合
      (pen.type &&
        store.active.some((active) => isConnectLine(store, active, pen)))
    ) {
      return;
    }

    // 得到图形的全部点
    const points = getPointsByPen(pen);
    if (!points) {
      return;
    }
    // 比对 points 中的点，必须找出最近的点，不可提前跳出
    for (const point of points) {
      for (const activePoint of activePoints) {
        const stepX = point.x - activePoint.x;
        const stepY = point.y - activePoint.y;
        const absStepX = Math.abs(stepX);
        const absStepY = Math.abs(stepY);
        if (!rect.center) {
          rect.center = {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
          };
        }
        if (absStepX < closeSize && absStepX < minCloseX) {
          xDock = {
            x: Math.round(point.x) + 0.5,
            y: Math.round(point.y) + 0.5,
            step: stepX,
            prev: {
              x: Math.round(activePoint.x) + 0.5,
              y: Math.round(activePoint.y) + 0.5,
            },
            penId: pen.id,
            anchorId: activePoint.id,
            dockAnchorId: point.id,
          };
          minCloseX = absStepX;
        }
        if (absStepY < closeSize && absStepY < minCloseY) {
          yDock = {
            x: Math.round(point.x) + 0.5,
            y: Math.round(point.y) + 0.5,
            step: stepY,
            prev: {
              x: Math.round(activePoint.x) + 0.5,
              y: Math.round(activePoint.y) + 0.5,
            },
            penId: pen.id,
            anchorId: activePoint.id,
            dockAnchorId: point.id,
          };
          minCloseY = absStepY;
        }
      }
    }
  });

  return {
    xDock,
    yDock,
  };
}

/**
 * 判断 line 是否是 active 的连接线（并且计算子节点）
 * @param store
 * @param active 本次计算的画笔
 * @param line 连线
 * @returns
 */
function isConnectLine(store: Meta2dStore, active: Pen, line: Pen) {
  if (!line.type) {
    return false;
  }
  if (Array.isArray(active?.connectedLines)) {
    for (const cline of active?.connectedLines) {
      if (cline.lineId === line.id) {
        return true;
      }
    }
  }
  // 考虑子节点
  if (Array.isArray(active?.children)) {
    for (const id of active.children) {
      const child = store.pens[id];
      if (isConnectLine(store, child, line)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 是否近似于 num
 * @param num
 */
export function isEqual(source: number, target: number): boolean {
  // @ts-ignore
  return source.toFixed(12) == target;
}

// 获取偏移量比较大的图元（认为是脏数据）
export function findOutliersByZScore(pens: Pen[], threshold = 4) {
  let points = pens.map((item) => item.calculative.worldRect);
  // 计算x和y的平均值和标准差
  const xValues = points.map((p) => p.x);
  const yValues = points.map((p) => p.y);

  const meanX = xValues.reduce((a, b) => a + b, 0) / xValues.length;
  const meanY = yValues.reduce((a, b) => a + b, 0) / yValues.length;

  const stdX = Math.sqrt(
    xValues.map((x) => Math.pow(x - meanX, 2)).reduce((a, b) => a + b, 0) /
      xValues.length
  );
  const stdY = Math.sqrt(
    yValues.map((y) => Math.pow(y - meanY, 2)).reduce((a, b) => a + b, 0) /
      yValues.length
  );

  // 计算每个点的综合z-score
  return pens.filter((pen) => {
    let point = pen.calculative.worldRect;
    const zX = (point.x - meanX) / stdX;
    const zY = (point.y - meanY) / stdY;
    const combinedZ = Math.sqrt(zX * zX + zY * zY);
    return combinedZ > threshold;
  });
}