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

    // 使用 activePens 中各图元的真实坐标，而不是 activeBoundary 的聚合坐标
    if (offsetX === 0) {
      const dstX = [Math.round(pen.x), pen.pivot?.x ? Math.round(pen.pivot.x) : Math.round(pen.x + pen.width / 2), Math.round(pen.ex)];
      for (const activePen of this.activePens) {
        const srcX = [activePen.x, activePen.pivot?.x || activePen.x + activePen.width / 2, activePen.ex];
        for (const sx of srcX) {
          for (const dx of dstX) {
            // 计算最终坐标的小数部分和取整值
            let finalPos = sx + x;
            let finalRounded = Math.round(finalPos);
            let offset = finalRounded - dx;

            if (Math.abs(offset) <= minX) {
              minX = Math.abs(offset);
              // 补偿偏差：确保最终坐标取整后等于目标
              offsetX = offset - (finalPos - Math.round(sx + x));
              xLine = {
                x: dx,
                y: Math.min(pen.y, Math.min(...this.activePens.map(p => p.y)) + y),
                ex: dx,
                ey: Math.max(pen.ey, Math.max(...this.activePens.map(p => p.ey)) + y),
              };
            }
          }
        }
      }
    }

    // 使用 activePens 中各图元的真实坐标，而不是 activeBoundary 的聚合坐标
    if (offsetY === 0) {
      const dstY = [Math.round(pen.y), pen.pivot?.y ? Math.round(pen.pivot.y) : Math.round(pen.y + pen.height / 2), Math.round(pen.ey)];
      for (const activePen of this.activePens) {
        const srcY = [activePen.y, activePen.pivot?.y || activePen.y + activePen.height / 2, activePen.ey];
        for (const sy of srcY) {
          for (const dy of dstY) {
            // 计算最终坐标的小数部分和取整值
            let finalPos = sy + y;
            let finalRounded = Math.round(finalPos);
            let offset = finalRounded - dy;

            if (Math.abs(offset) <= minY) {
              minY = Math.abs(offset);
              // 补偿偏差：确保最终坐标取整后等于目标
              offsetY = offset - (finalPos - Math.round(sy + y));
              yLine = {
                x: Math.min(pen.x, Math.min(...this.activePens.map(p => p.x)) + x),
                y: dy,
                ex: Math.max(pen.ex, Math.max(...this.activePens.map(p => p.ex)) + x),
                ey: dy,
              };
            }
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
