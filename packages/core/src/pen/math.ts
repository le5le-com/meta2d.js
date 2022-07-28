import { PenType } from '.';
import { Point } from '../point';
import {
  calcCenter,
  expandRect,
  Rect,
  rectInFourAngRect,
  rectToPoints,
} from '../rect';
import { TopologyStore } from '../store';
import { deepClone } from '../utils';
import { Pen } from './model';

export function calcAnchorDock(
  store: TopologyStore,
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

      const disX = Math.abs(pt.x - e.x);
      if (disX > 0 && disX < size && disX < x) {
        xDock = {
          x: Math.round(pt.x) + 0.5,
          y: Math.round(pt.y) + 0.5,
          prev: {
            x: Math.round(e.x) + 0.5,
            y: Math.round(e.y) + 0.5,
          },
          step: pt.x - e.x,
        };
        x = disX;
      }
      const disY = Math.abs(pt.y - e.y);
      if (disY > 0 && disY < size && disY < y) {
        yDock = {
          x: Math.round(pt.x) + 0.5,
          y: Math.round(pt.y) + 0.5,
          prev: {
            x: Math.round(e.x) + 0.5,
            y: Math.round(e.y) + 0.5,
          },
          step: pt.y - e.y,
        };
        y = disY;
      }
    });
  }

  return {
    xDock,
    yDock,
  };
}

export function calcMoveDock(
  store: TopologyStore,
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
      ...outerPoints,
      ...pen.calculative.worldAnchors,
      pen.calculative.worldRect.center,
    ];
  } else if (pen.type === PenType.Line) {
    return pen.calculative.worldAnchors;
  }
}

export function calcResizeDock(
  store: TopologyStore,
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
  store: TopologyStore,
  activePoints: Point[],
  rect: Rect,
  calcActive = false
): { xDock: Point; yDock: Point } {
  let xDock: Point;
  let yDock: Point;
  let x = Infinity;
  let y = Infinity;
  const size = 8;
  const paddingRect = expandRect(rect, size); // rect 扩大 size 区域
  // 过滤出本次需要计算的画笔们
  const pens = store.data.pens.filter((pen) => {
    const { inView, worldRect, active } = pen.calculative;
    return !(
      inView === false ||
      (!calcActive && active) || // 如果不计算活动层，则过滤掉活动层
      rectInFourAngRect(paddingRect, worldRect) || // 水平和垂直方向 无重合
      (pen.type &&
        store.active.some((active) => isConnectLine(store, active, pen)))
    );
  });
  for (const pen of pens) {
    // 得到图形的全部点
    const points = getPointsByPen(pen);
    // 比对 points 中的点，必须找出最近的点，不可提前跳出
    for (const point of points) {
      for (const activePoint of activePoints) {
        const stepX = point.x - activePoint.x;
        const stepY = point.y - activePoint.y;
        const absStepX = Math.abs(stepX);
        const absStepY = Math.abs(stepY);
        if (absStepX < size && absStepX < x) {
          xDock = {
            x: Math.round(point.x) + 0.5,
            y: Math.round(point.y) + 0.5,
            step: stepX,
            prev: {
              x: Math.round(activePoint.x) + 0.5,
              y: Math.round(activePoint.y) + 0.5,
            },
            penId: pen.id,
          };
          x = absStepX;
        }
        if (absStepY < size && absStepY < y) {
          yDock = {
            x: Math.round(point.x) + 0.5,
            y: Math.round(point.y) + 0.5,
            step: stepY,
            prev: {
              x: Math.round(activePoint.x) + 0.5,
              y: Math.round(activePoint.y) + 0.5,
            },
            penId: pen.id,
          };
          y = absStepY;
        }
      }
    }
  }
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
function isConnectLine(store: TopologyStore, active: Pen, line: Pen) {
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
