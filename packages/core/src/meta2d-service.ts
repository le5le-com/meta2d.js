import { Meta2d } from './meta2d';
import { Pen, PenCategory } from './models';

export function snapToPen(this: Meta2d, x: number, y: number) {
  let offsetX = 0;
  let offsetY = 0;
  let xLine: Pen;
  let yLine: Pen;

  let minX = 10;
  let minY = 10;

  if (this.guideLines) {
    for (const line of this.guideLines) {
      if (line.isVertical) {
        const srcY = [this.activeBoundary.y, this.activeBoundary.pivot.y, this.activeBoundary.ey];
        for (const sy of srcY) {
          let offset = sy + y - line.pos;
          if (Math.abs(offset) <= minY) {
            minY = Math.abs(offset);
            offsetY = offset;
          }
        }

        continue;
      }

      const srcX = [this.activeBoundary.x, this.activeBoundary.pivot.x, this.activeBoundary.ex];
      for (const sx of srcX) {
        let offset = sx + x - line.pos;
        if (Math.abs(offset) <= minX) {
          minX = Math.abs(offset);
          offsetX = offset;
        }
      }
    }
  }

  // 辅助线的优先级最高
  if (offsetX !== 0 && offsetY !== 0) {
    return {
      offsetX,
      offsetY,
    };
  }

  // 本函数在拖拽过程中每个 mousemove 调一次，循环体跑满 penMap。
  // 原来这里是 `activePens.find(...)` + `inViewPenIds.includes(...)`，两个都是线性扫：
  // 2 万图元 + 1.8 万在视口内时约 2.4e8 次字符串比较/次。两者都换成 O(1)。
  const activeIdSet = new Set<string>();
  for (const item of this.activePens) {
    activeIdSet.add(item.id);
  }
  const inViewSet = this.inViewPenIdSet;

  for (const [, pen] of this.penMap) {
    if (pen.category === PenCategory.Line || activeIdSet.has(pen.id) || !inViewSet.has(pen.id)) {
      continue;
    }

    if (offsetX === 0) {
      const srcX = [this.activeBoundary.x, this.activeBoundary.pivot.x, this.activeBoundary.ex];
      const dstX = [pen.x, pen.pivot.x, pen.ex];
      for (const sx of srcX) {
        for (const dx of dstX) {
          let offset = sx + x - dx;
          if (Math.abs(offset) <= minX) {
            minX = Math.abs(offset);
            offsetX = offset;
            xLine = {
              x: dx,
              y: Math.min(pen.y, this.activeBoundary.y + y),
              ex: dx,
              ey: Math.max(pen.ey, this.activeBoundary.ey + y),
            };
          }
        }
      }
    }

    if (offsetY === 0) {
      const srcY = [this.activeBoundary.y, this.activeBoundary.pivot.y, this.activeBoundary.ey];
      const dstY = [pen.y, pen.pivot.y, pen.ey];
      for (const sy of srcY) {
        for (const dy of dstY) {
          let offset = sy + y - dy;
          if (Math.abs(offset) <= minY) {
            minY = Math.abs(offset);
            offsetY = offset;
            yLine = {
              x: Math.min(pen.x, this.activeBoundary.x + x),
              y: dy,
              ex: Math.max(pen.ex, this.activeBoundary.ex + x),
              ey: dy,
            };
          }
        }
      }
    }
  }

  return {
    offsetX,
    offsetY,
    xLine,
    yLine,
  };
}
