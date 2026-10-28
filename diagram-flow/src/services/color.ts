import { ColorStop, Gradient } from '@meta2d/core';

// css的线性渐变转换为canvas的线性渐变。
// 根据当前颜色控件，css的线性渐变方向只考虑角度（deg），颜色停靠点位置只考虑百分比
// 例如：linear-gradient(90deg,hsla(7, 61%, 64%, 0.45) 0%,rgb(73, 106, 220) 100%)
export function cssToCanvasLinerGradient(css: string): Gradient {
  const linearMatch = css.match(/^linear-gradient\(([^,]+),(.+)\)$/);
  if (!linearMatch) return;

  const angleStr = linearMatch[1].trim();
  const stopsStr = linearMatch[2].trim();

  // 解析角度
  let angle = 0;
  if (angleStr.endsWith('deg')) {
    angle = parseFloat(angleStr.slice(0, -3));
  } else {
    angle = 0;
  }

  const colorStopRegex = /((rgba?\([^)]+\))|(#\w+)|hsla?\([^)]+\))\s*([\d.]+)%/gi;

  const colorStops: ColorStop[] = [];
  let match: RegExpExecArray | null;
  while ((match = colorStopRegex.exec(stopsStr)) !== null) {
    const color = match[1];
    const posPercent = parseFloat(match[4]);
    const i = posPercent / 100;
    colorStops.push({ i, color });
  }

  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad - Math.PI / 2);
  const dy = Math.sin(rad - Math.PI / 2);

  // 起点中心在画布中心，根据dx,dy伸展到边界
  const halfDiag = Math.SQRT2 / 2;

  const cx = 0.5;
  const cy = 0.5;

  const x0 = cx - dx * halfDiag;
  const y0 = cy - dy * halfDiag;
  const x1 = cx + dx * halfDiag;
  const y1 = cy + dy * halfDiag;

  const gradient: Gradient = {
    type: 1,
    x0,
    y0,
    x1,
    y1,
    colorStops,
  };

  return gradient;
}

// css的线性渐变转换为canvas的渐变渐变
// 受限于当前颜色控件，坐标基准点固定是中点(0.5, 0.5)，首尾两个位置百分比（0~1）作为内外圆心的偏移距离，不考虑半径大小
// 偏移方向由 deg 角度决定（从中点出发）
export function cssToCanvasRadialGradient(css: string): Gradient {
  const linearMatch = css.match(/^linear-gradient\(([^,]+),(.+)\)$/);
  if (!linearMatch) return;

  const angleStr = linearMatch[1].trim();
  const stopsStr = linearMatch[2].trim();

  // 解析角度
  let angle = 0;
  if (angleStr.endsWith('deg')) {
    angle = parseFloat(angleStr.slice(0, -3));
  } else {
    angle = 0;
  }

  const colorStopRegex = /((rgba?\([^)]+\))|(#\w+)|hsla?\([^)]+\))\s*([\d.]+)%/gi;

  const colorStops: ColorStop[] = [];
  let match: RegExpExecArray | null;
  while ((match = colorStopRegex.exec(stopsStr)) !== null) {
    const color = match[1];
    const posPercent = parseFloat(match[4]);
    const i = posPercent / 100;
    colorStops.push({ i, color });
  }

  if (colorStops.length < 2) return;

  // 计算线性渐变起点和终点
  const rad = (angle * Math.PI) / 180;

  // 中点
  const cx = 0.5;
  const cy = 0.5;

  // 内圆心以第一个色标位置偏移距离
  const offset0 = colorStops[0].i; // 0~1
  const x0 = cx + Math.cos(rad) * offset0;
  const y0 = cy + Math.sin(rad) * offset0;

  // 外圆心以最后一个色标位置偏移距离
  const offset1 = colorStops[colorStops.length - 1].i;
  const x1 = cx + Math.cos(rad) * offset1;
  const y1 = cy + Math.sin(rad) * offset1;

  return {
    type: 2,
    x0,
    y0,
    x1,
    y1,
    colorStops,
  };
}
