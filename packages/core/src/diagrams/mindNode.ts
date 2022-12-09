import { calcWorldAnchors, Pen, Point } from '@meta2d/core';
import { rectangle } from '.';

export function mindNode(pen: Pen, ctx?: CanvasRenderingContext2D) {
  if (!pen.onResize) {
    pen.onResize = resize;
    pen.onValue = value;
  }

  return rectangle(pen, ctx);
}

function resize(pen: Pen) {
  // 过滤出非默认锚点，即自定义锚点
  const manualPoints = pen.anchors.filter((point: Point) => point.flag !== 1);
  mindNodeAnchors(pen);
  pen.anchors = pen.anchors.concat(...manualPoints);
}

function value(pen: Pen) {
  resize(pen);
  calcWorldAnchors(pen);
}

export function mindNodeAnchors(pen: Pen) {
  // TODO: 组合状态下的 width height 成了固定的百分比
  const anchors: Point[] = [];
  const { x: rectX, y: rectY, width, height } = pen;
  const r = borderRadius(pen);
  // 上四
  const topN = 5; // 上方节点个数，控制位置，实际节点数依然是 4 个
  for (let i = 0; i < topN; i++) {
    if (i === 2) {
      continue;
    }
    let x = rectX + (width * (i + 1)) / (topN + 1);
    let y = rectY;
    if (x < rectX + r) {
      // 在左侧圆角
      y = getYByCircle(rectX + r, y + r, x, r, -1);
    } else if (x > rectX + width - r) {
      // 在右侧圆角
      y = getYByCircle(rectX + width - r, y + r, x, r, -1);
    }
    anchors.push({
      id: String(anchors.length),
      flag: 1,
      penId: pen.id,
      x: (x - rectX) / width,
      y: (y - rectY) / height,
    });
  }
  // 右三
  const rightN = 3; // 右侧节点数
  for (let i = 0; i < rightN; i++) {
    let y = rectY + (height * (i + 1)) / (rightN + 1);
    let x = rectX + width;
    if (y < rectY + r) {
      // 在上侧圆角以内
      x = getXByCircle(x - r, rectY + r, y, r);
    } else if (y > rectY + height - r) {
      // 下侧圆角
      x = getXByCircle(x - r, rectY + height - r, y, r);
    }
    anchors.push({
      id: String(anchors.length),
      flag: 1,
      penId: pen.id,
      x: (x - rectX) / width,
      y: (y - rectY) / height,
    });
  }
  // 下四
  const bottomN = 5; // 下侧节点数
  for (let i = 0; i < bottomN; i++) {
    if (i === 2) {
      continue;
    }
    let x = rectX + (width * (i + 1)) / (bottomN + 1);
    let y = rectY + height;
    if (x < rectX + r) {
      // 在左侧圆角
      y = getYByCircle(rectX + r, y - r, x, r);
    } else if (x > rectX + width - r) {
      // 在右侧圆角
      y = getYByCircle(rectX + width - r, y - r, x, r);
    }
    anchors.push({
      id: String(anchors.length),
      flag: 1,
      penId: pen.id,
      x: (x - rectX) / width,
      y: (y - rectY) / height,
    });
  }
  // 左三
  const leftN = 3; // 左侧节点数
  for (let i = 0; i < leftN; i++) {
    let y = rectY + (height * (i + 1)) / (leftN + 1);
    let x = rectX;
    if (y < rectY + r) {
      // 在上侧圆角以内
      x = getXByCircle(x + r, rectY + r, y, r, -1);
    } else if (y > rectY + height - r) {
      // 下侧圆角
      x = getXByCircle(x + r, rectY + height - r, y, r, -1);
    }
    anchors.push({
      id: String(anchors.length),
      flag: 1,
      penId: pen.id,
      x: (x - rectX) / width,
      y: (y - rectY) / height,
    });
  }
  pen.anchors = anchors;
}

/**
 * 得到元素实际计算半径
 * @param node 元素
 * @returns 元素实际半径
 */
function borderRadius(pen: Pen): number {
  let wr = pen.calculative.borderRadius || 0;
  let hr = pen.calculative.borderRadius || 0;
  const { width, height } = pen;
  if (pen.calculative.borderRadius < 1) {
    wr = width * pen.calculative.borderRadius;
    hr = height * pen.calculative.borderRadius;
  }
  let r = wr < hr ? wr : hr;
  if (width < 2 * r) {
    r = width / 2;
  }
  if (height < 2 * r) {
    r = height / 2;
  }
  return r;
}

/**
 * 获取圆的 x 坐标
 * @param ox 圆心x
 * @param oy 圆心y
 * @param y y
 * @param r 半径
 * @param sqrt 点可能在左侧，左侧填-1，右侧1（默认值）
 */
function getXByCircle(
  ox: number,
  oy: number,
  y: number,
  r: number,
  sqrt: number = 1
): number {
  return sqrt * Math.sqrt(r ** 2 - (y - oy) ** 2) + ox;
}

/**
 * 获取圆的 y 坐标
 * @param ox 圆心x
 * @param oy 圆心y
 * @param y y
 * @param r 半径
 * @param sqrt 点可以在上侧，也可能在下侧，上侧-1，下侧1（默认）
 */
function getYByCircle(
  ox: number,
  oy: number,
  x: number,
  r: number,
  sqrt: number = 1
): number {
  return sqrt * Math.sqrt(r ** 2 - (x - ox) ** 2) + oy;
}
