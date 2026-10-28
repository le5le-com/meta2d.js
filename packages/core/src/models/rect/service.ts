import { ResizePoints } from '../../const';
import { limitAbs, Matrix3x3, Vector2D } from '../../math';
import { Pen } from '../pen';
import { Point, pointInVertices, rotatePoint, scalePoint } from '../point';
import { Rect } from './rect';
import { ControlPointType, Padding } from './types';

export function translateRect(rect: Rect | Pen, offsetX: number, offsetY: number) {
  rect.x += offsetX;
  rect.y += offsetY;
  if (rect.width != undefined) {
    rect.ex = rect.x + rect.width;
    rect.ey = rect.y + rect.height;
  } else {
    rect.ex += offsetX;
    rect.ey += offsetY;
  }

  if ((rect as Pen).anchors) {
    (rect as Pen).anchors.forEach((pt: Point) => {
      pt.x += offsetX;
      pt.y += offsetY;
      if (pt.cp1) {
        pt.cp1.x += offsetX;
        pt.cp1.y += offsetY;
      }
      if (pt.cp2) {
        pt.cp2.x += offsetX;
        pt.cp2.y += offsetY;
      }
    });
  }

  if (rect.pivot) {
    rect.pivot.x += offsetX;
    rect.pivot.y += offsetY;
  }

  if (rect.box) {
    rect.box.x += offsetX;
    rect.box.y += offsetY;
    rect.box.ex += offsetX;
    rect.box.ey += offsetY;
  }
}

export function getBoundary(pens: Pen[], textBoxs: any): Rect {
  if (pens.length === 1) {
    // 保留单选图元的旋转特性

    const pen = pens[0];
    const rect: Rect = {
      x: pen.x,
      y: pen.y,
      width: pen.width,
      height: pen.height,
      ex: pen.ex,
      ey: pen.ey,
      rotate: pen.rotate,
    };

    if (pen.lineWidth > 1) {
      expandRect(rect, pen.lineWidth / 2);
    }

    const textBox = pen.textBox || (textBoxs && textBoxs[pen.id]);
    if (textBox) {
      if (textBox.x < rect.x) {
        rect.x = textBox.x;
      }
      if (textBox.y < rect.y) {
        rect.y = textBox.y;
      }
      if (textBox.ex > rect.ex) {
        rect.ex = textBox.ex;
      }
      if (textBox.ey > rect.ey) {
        rect.ey = textBox.ey;
      }
      rect.width = rect.ex - rect.x;
      rect.height = rect.ey - rect.y;
    }

    // 单选并存在旋转时，需要计算一个未旋转的矩形包围盒
    if (rect.rotate) {
      const points = rectToPoints(rect);
      if (textBox) {
        textBox.rotate = pen.rotate;
        points.push(...rectToPoints(textBox));
      }
      rect.box = getRectOfPoints(points);
    }

    expandBoundaryByShadow(rect, [pen]);
    return rect;
  }

  const points: Point[] = [];
  pens.forEach((pen) => {
    if (pen.lineWidth > 1) {
      let p = structuredClone(pen);
      expandRect(p, p.lineWidth / 2);
      points.push(...rectToPoints(p));
    } else {
      points.push(...rectToPoints(pen));
    }

    // 如果有文字范围，加入文字范围
    const textBox = pen.textBox || (textBoxs && textBoxs[pen.id]);
    if (textBox) {
      textBox.rotate = pen.rotate;
      points.push(...rectToPoints(textBox));
    }

    points.push(...rectToPoints(pen));
  });

  const boundary = getRectOfPoints(points);
  expandBoundaryByShadow(boundary, pens);
  return boundary;
}

function expandBoundaryByShadow(boundary: Rect, pens: Pen[]) {
  const rect = boundary.box || boundary;
  normalizeRectSize(rect);

  const shadowPadding = getPensShadowPadding(pens);
  if (shadowPadding) {
    expandRect(rect, shadowPadding);
  }
}

function normalizeRectSize(rect: Rect) {
  if (rect.ex == undefined && rect.x != undefined && rect.width != undefined) {
    rect.ex = rect.x + rect.width;
  }
  if (rect.ey == undefined && rect.y != undefined && rect.height != undefined) {
    rect.ey = rect.y + rect.height;
  }
  if (rect.width == undefined && rect.x != undefined && rect.ex != undefined) {
    rect.width = rect.ex - rect.x;
  }
  if (rect.height == undefined && rect.y != undefined && rect.ey != undefined) {
    rect.height = rect.ey - rect.y;
  }
}

function getPensShadowPadding(pens: Pen[]): number[] | undefined {
  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;

  for (const pen of pens) {
    const penPadding = getPenShadowPadding(pen);
    if (!penPadding) {
      continue;
    }

    top = Math.max(top, penPadding[0]);
    right = Math.max(right, penPadding[1]);
    bottom = Math.max(bottom, penPadding[2]);
    left = Math.max(left, penPadding[3]);
  }

  if (!top && !right && !bottom && !left) {
    return;
  }

  return [top, right, bottom, left];
}

function getPenShadowPadding(pen: Pen): number[] | undefined {
  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;

  if (pen.shadowColor) {
    const padding = getShadowPadding(
      pen.shadowBlur || 0,
      pen.shadowOffsetX || 0,
      pen.shadowOffsetY || 0
    );
    top = Math.max(top, padding[0]);
    right = Math.max(right, padding[1]);
    bottom = Math.max(bottom, padding[2]);
    left = Math.max(left, padding[3]);
  }

  if (pen.textShadow) {
    const padding = getShadowPadding(
      pen.textShadowBlur || pen.shadowBlur || 0,
      pen.textShadowOffsetX || pen.shadowOffsetX || 0,
      pen.textShadowOffsetY || pen.shadowOffsetY || 0
    );
    top = Math.max(top, padding[0]);
    right = Math.max(right, padding[1]);
    bottom = Math.max(bottom, padding[2]);
    left = Math.max(left, padding[3]);
  }

  if (!top && !right && !bottom && !left) {
    return;
  }

  return [top, right, bottom, left];
}

// Canvas 阴影的实际模糊尾部可能超出 shadowBlur 的名义范围，需预留更保守的擦除边界。
// blur 为 0 时仍可能产生半像素抗锯齿，阴影存在时至少擦除 1 个像素。
function getShadowPadding(blur: number, offsetX: number, offsetY: number): number[] {
  const safeBlur = Math.max(blur || 0, 0);
  const blurPadding = safeBlur ? safeBlur * 3 : 1;
  return [
    blurPadding + Math.max(0, -offsetY),
    blurPadding + Math.max(0, offsetX),
    blurPadding + Math.max(0, offsetY),
    blurPadding + Math.max(0, -offsetX),
  ];
}

export function rectToPoints(rect: Rect) {
  const pts = [
    { x: rect.x, y: rect.y },
    { x: rect.ex, y: rect.y },
    { x: rect.ex, y: rect.ey },
    { x: rect.x, y: rect.ey },
  ];

  if (rect.rotate) {
    pts.forEach((pt) => {
      rotatePoint(
        pt,
        rect.rotate,
        rect.pivot || { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      );
    });
  }
  return pts;
}

export function getRectOfPoints(points: Point[]): Rect {
  let x = Infinity;
  let y = Infinity;
  let ex = -Infinity;
  let ey = -Infinity;

  points?.forEach((item) => {
    if (!isFinite(item.x) || !isFinite(item.y)) {
      return;
    }
    x = Math.min(x, item.x);
    y = Math.min(y, item.y);
    ex = Math.max(ex, item.x);
    ey = Math.max(ey, item.y);
  });
  return {
    x,
    y,
    ex,
    ey,
    width: ex - x,
    height: ey - y,
  };
}

export function scaleRect(rect: Rect, scale: number, center: Point) {
  if (!rect) {
    return;
  }
  rect.width *= scale;
  rect.height *= scale;
  scalePoint(rect as Point, scale, center);
  calcRightBottom(rect);
}

export function calcRightBottom(rect: Rect) {
  rect.ex = rect.x + rect.width;
  rect.ey = rect.y + rect.height;
}

export function calcCenter(rect: Rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function calcAbsPoint(rect: Rect, pt: Point) {
  const p: Point = { ...pt };
  p.x = rect.x + rect.width * pt.x;
  p.y = rect.y + rect.height * pt.y;

  return p;
}

export function pointInRect(pt: Point, rect: Rect) {
  // Worker 计算包围盒是异步的，鼠标事件可能先于 activeBoundary 返回；未准备好时按未命中处理。
  if (!pt || !rect) {
    return false;
  }
  if (!rect.rotate) {
    return pt.x >= rect.x && pt.x <= rect.ex && pt.y >= rect.y && pt.y <= rect.ey;
  }

  const pts: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.ex, y: rect.y },
    { x: rect.ex, y: rect.ey },
    { x: rect.x, y: rect.ey },
  ];
  pts.forEach((item: Point) => {
    rotatePoint(
      item,
      rect.rotate,
      rect.pivot || { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    );
  });

  return pointInVertices(pt, pts);
}

export function rectInRect(source: Rect, target: Rect, allIn?: boolean) {
  if (source.rotate) {
    // 根据 rotate 扩大 rect
    source = getRectOfPoints(rectToPoints(source)); // 更改 source 引用地址值，不影响原值
  }
  if (allIn) {
    return (
      source.x > target.x && source.ex < target.ex && source.y > target.y && source.ey < target.ey
    );
  }
  return !(
    source.x > target.ex ||
    source.ex < target.x ||
    source.ey < target.y ||
    source.y > target.ey
  );
}

export function expandRect(rect: Rect, size: Padding) {
  const padding = formatPadding(size);
  rect.x -= padding[3];
  rect.y -= padding[0];
  rect.width += padding[1] + padding[3];
  rect.height += padding[0] + padding[2];
  rect.ex = rect.x + rect.width;
  rect.ey = rect.y + rect.height;
}

export function rotateRect(rect: Rect, angle: number, pivot: Point) {
  if (!angle || angle % 360 === 0) {
    return;
  }

  rect.rotate += angle;

  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  rotatePoint(center, angle, pivot);
  rect.x = center.x - rect.width / 2;
  rect.y = center.y - rect.height / 2;
  rect.ex = rect.x + rect.width;
  rect.ey = rect.y + rect.height;

  rect.pivot && rotatePoint(rect.pivot, angle, pivot);
}

export const formatPadding = (padding: Padding): number[] => {
  let top = 0;
  let left = 0;
  let right = 0;
  let bottom = 0;

  if (typeof padding === 'number') {
    top = left = right = bottom = padding;
  } else if (typeof padding === 'string') {
    const intPadding = parseInt(padding, 10);
    top = left = right = bottom = intPadding;
  } else if (Array.isArray(padding)) {
    top = padding[0];
    right = padding[1] != null ? padding[1] : padding[0];
    bottom = padding[2] != null ? padding[2] : padding[0];
    left = padding[3] != null ? padding[3] : right;
  }
  return [top, right, bottom, left];
};

export function resizeRect(rect: Rect, sizeDirection: number, dx: number, dy: number, centerResize?: boolean, keepRatio?: boolean): Rect {
  if (!rect.rotate) {
    rect.rotate = 0;
  }
  if (!rect.pivot) {
    rect.pivot = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }

  const isVertical = sizeDirection === 0 || sizeDirection === 4; // 垂直点
  const isHorizontal = sizeDirection === 2 || sizeDirection === 6; // 水平点
  const rad = (rect.rotate * Math.PI) / 180;

  let { x, y, width, height, pivot } = rect;

  const originalCenterX = x + width / 2;
  const originalCenterY = y + height / 2;

  let adjustedDx = dx;
  let adjustedDy = dy;
  if (centerResize) {
    adjustedDx = dx * 2;
    adjustedDy = dy * 2;
  }

  const oppositeCpIndex = (sizeDirection + 4) % 8;
  // 控制点的局部坐标
  const cp = ResizePoints[sizeDirection];
  const oppositeCp = ResizePoints[oppositeCpIndex];

  // 计算未旋转状态下的控制点位置（矩形局部坐标）
  const localCpX = cp.x * width;
  const localCpY = cp.y * height;
  const localOppX = oppositeCp.x * width;
  const localOppY = oppositeCp.y * height;

  // 将鼠标位移转换到矩形的局部坐标系
  const [localDx, localDy] = new Vector2D(adjustedDx, adjustedDy)
    .transform(
      Matrix3x3.rotate(rad).inverse() // 旋转矩阵的逆矩阵
    )
    .toArray();

  // 计算新的控制点位置（局部坐标）
  let newLocalCpX = localCpX;
  let newLocalCpY = localCpY;

  if (isVertical) {
    newLocalCpY = localCpY + localDy;
    newLocalCpX = localCpX;
  } else if (isHorizontal) {
    newLocalCpX = localCpX + localDx;
    newLocalCpY = localCpY;
  } else {
    newLocalCpX = localCpX + localDx;
    newLocalCpY = localCpY + localDy;
  }

  const ruleMap = {
    0: {
      height: (cp, op) => op - cp,
    },
    1: {
      width: (cp, op) => cp - op,
      height: (cp, op) => op - cp,
    },
    2: {
      width: (cp, op) => cp - op,
    },
    3: {
      width: (cp, op) => cp - op,
      height: (cp, op) => cp - op,
    },
    4: {
      height: (cp, op) => cp - op,
    },
    5: {
      width: (cp, op) => op - cp,
      height: (cp, op) => cp - op,
    },
    6: {
      width: (cp, op) => op - cp,
    },
    7: {
      width: (cp, op) => op - cp,
      height: (cp, op) => op - cp,
    },
  };
  let newWidth = limitAbs(
    ruleMap[sizeDirection].width?.(newLocalCpX, localOppX) ?? rect.width,
    0.001
  );
  let newHeight = limitAbs(
    ruleMap[sizeDirection].height?.(newLocalCpY, localOppY) ?? rect.height,
    0.001
  );

  if (isVertical) {
    newWidth = width;
  }
  if (isHorizontal) {
    newHeight = height;
  }

  let newX: number;
  let newY: number;
  if (keepRatio && width > 0 && height > 0) {
    const aspectRatio = width / height;

    if (isVertical) {
      newWidth = limitAbs(newHeight * aspectRatio, 0.001);
    } else if (isHorizontal) {
      newHeight = limitAbs(newWidth / aspectRatio, 0.001);
    } else {
      const dirX = localCpX - localOppX;
      const dirY = localCpY - localOppY;
      const dirLen = Math.hypot(dirX, dirY);

      if (dirLen > 0.000001) {
        const moveX = newLocalCpX - localCpX;
        const moveY = newLocalCpY - localCpY;
        const projected = (moveX * dirX + moveY * dirY) / dirLen;
        let targetLen = dirLen + projected;

        if (Math.abs(targetLen) < 0.001) {
          targetLen = targetLen >= 0 ? 0.001 : -0.001;
        }

        const scale = targetLen / dirLen;
        const absScale = Math.abs(scale);

        newWidth = limitAbs(width * absScale, 0.001);
        newHeight = limitAbs(newWidth / aspectRatio, 0.001);

        const unitX = dirX / dirLen;
        const unitY = dirY / dirLen;
        newLocalCpX = localOppX + unitX * targetLen;
        newLocalCpY = localOppY + unitY * targetLen;
      }
    }
  }

  if (centerResize) {
    newX = originalCenterX - newWidth / 2;
    newY = originalCenterY - newHeight / 2;
  } else {
    const newLocalCenterX = (newLocalCpX + localOppX) / 2;
    const newLocalCenterY = (newLocalCpY + localOppY) / 2;

    const centerOffsetX = newLocalCenterX - width / 2;
    const centerOffsetY = newLocalCenterY - height / 2;

    const [globalCenterOffsetX, globalCenterOffsetY] = new Vector2D(centerOffsetX, centerOffsetY)
      .rotate(rad)
      .toArray();

    const newGlobalCenterX = originalCenterX + globalCenterOffsetX;
    const newGlobalCenterY = originalCenterY + globalCenterOffsetY;

    newX = newGlobalCenterX - newWidth / 2;
    newY = newGlobalCenterY - newHeight / 2;
  }

  // 保持 pivot 相对于矩形的比例位置不变
  const pivotRatioX = (pivot.x - x) / width;
  const pivotRatioY = (pivot.y - y) / height;

  const newPivot = {
    x: newX + newWidth * pivotRatioX,
    y: newY + newHeight * pivotRatioY,
  };

  return {
    ...rect,
    x: newX,
    y: newY,
    ex: newX + newWidth,
    ey: newY + newHeight,
    width: newWidth,
    height: newHeight,
    pivot: newPivot,
  };
}

/**
 * @param rotateOffset 旋转控制点离四角的距离（世界坐标）。hover 按固定屏幕尺寸画控制框，调用方可按缩放换算，
 *   否则缩小后旋转点贴着角上的缩放点、放大后又离得很远。默认 8，与原来相同。
 */
export function getBoundingCPs(rect: Rect, type = ControlPointType.Both, rotateOffset = 8): Point[] {
  if (!rect) {
    return;
  }

  const cps = [];

  let { x, y, width, height, pivot } = rect;

  if (type & ControlPointType.Size) {
    if (!pivot) {
      pivot = { x: x + width / 2, y: y + height / 2 };
    }
    ResizePoints.forEach((pt) => {
      const p = {
        x: pt.x * width + x,
        y: pt.y * height + y,
      };
      cps.push(p);
    });
  }

  if (type & ControlPointType.Rotate) {
    const o = rotateOffset;
    // 添加4个角的旋转控制点
    cps.push({
      x: x - o,
      y: y - o,
      rotate: 1,
    });
    cps.push({
      x: x - o,
      y: y,
      rotate: 1,
    });
    cps.push({
      x: x,
      y: y - o,
      rotate: 1,
    });
    cps.push({
      x: x + width + o,
      y: y - o,
      rotate: 2,
    });
    cps.push({
      x: x + width,
      y: y - o,
      rotate: 2,
    });
    cps.push({
      x: x + width + o,
      y: y,
      rotate: 2,
    });
    cps.push({
      x: x + width + o,
      y: y + height + o,
      rotate: 3,
    });
    cps.push({
      x: x + width + o,
      y: y + height,
      rotate: 3,
    });
    cps.push({
      x: x + width,
      y: y + height + o,
      rotate: 3,
    });
    cps.push({
      x: x - o,
      y: y + height + o,
      rotate: 4,
    });
    cps.push({
      x: x - o,
      y: y + height,
      rotate: 4,
    });
    cps.push({
      x: x,
      y: y + height + o,
      rotate: 4,
    });
  }

  return cps;
}

export function getFlipRect(rect: Rect, flipX: boolean, flipY: boolean): Rect {
  rect = { ...rect };
  if (!rect.width) {
    rect.width = Math.abs(rect.ex - rect.x);
    rect.height = Math.abs(rect.ey - rect.y);
  }

  if (flipX) {
    rect.ex = rect.x;
    rect.x = rect.ex - rect.width;
  }

  if (flipY) {
    rect.ey = rect.y;
    rect.y = rect.ey - rect.height;
  }

  return rect;
}
