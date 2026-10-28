import { ColorStop, Gradient } from '../models/pen';

// pSBC - Shade Blend Convert - Version 4.0 - 02/18/2019
// https://github.com/PimpTrizkit/PJs/edit/master/pSBC.js

export function pSBCr(d) {
  const i = parseInt,
    m = Math.round;
  let n = d.length,
    x: any = {};
  if (n > 9) {
    const [r, g, b, a] = (d = d.split(','));
    n = d.length;
    if (n < 3 || n > 4) return null;
    (x.r = i(r[3] == 'a' ? r.slice(5) : r.slice(4))),
      (x.g = i(g)),
      (x.b = i(b)),
      (x.a = a ? parseFloat(a) : -1);
  } else {
    if (n == 8 || n == 6 || n < 4) return null;
    if (n < 6) d = '#' + d[1] + d[1] + d[2] + d[2] + d[3] + d[3] + (n > 4 ? d[4] + d[4] : '');
    d = i(d.slice(1), 16);
    if (n == 9 || n == 5)
      (x.r = (d >> 24) & 255),
        (x.g = (d >> 16) & 255),
        (x.b = (d >> 8) & 255),
        (x.a = m((d & 255) / 0.255) / 1000);
    else (x.r = d >> 16), (x.g = (d >> 8) & 255), (x.b = d & 255), (x.a = -1);
  }
  return x;
}

/*
example：
pSBC ( 0.42, color1 ); // rgb(20,60,200) + [42% Lighter] => rgb(166,171,225)
pSBC ( -0.4, color5 ); // #F3A + [40% Darker] => #c62884

pSBC ( -0.5, color2, color8, true ); // rgba(20,60,200,0.67423) + rgba(200,60,20,0.98631) + [50% Blend] => rgba(110,60,110,0.83)
pSBC ( 0.7, color2, color7, true ); // rgba(20,60,200,0.67423) + rgb(200,60,20) + [70% Blend] => rgba(146,60,74,0.67423)

more:
https://github-wiki-see.page/m/PimpTrizkit/PJs/wiki/12.-Shade%2C-Blend-and-Convert-a-Web-Color-%28pSBC.js%29
*/

export function pSBC(p, c0, c1?, l?) {
  let r,
    g,
    b,
    P,
    f,
    t,
    h,
    m = Math.round,
    a: any = typeof c1 == 'string';
  if (
    typeof p != 'number' ||
    p < -1 ||
    p > 1 ||
    typeof c0 != 'string' ||
    (c0[0] != 'r' && c0[0] != '#') ||
    (c1 && !a)
  )
    return null;
  (h = c0.length > 9),
    (h = a ? (c1.length > 9 ? true : c1 == 'c' ? !h : false) : h),
    (f = pSBCr(c0)),
    (P = p < 0),
    (t =
      c1 && c1 != 'c'
        ? pSBCr(c1)
        : P
        ? { r: 0, g: 0, b: 0, a: -1 }
        : { r: 255, g: 255, b: 255, a: -1 }),
    (p = P ? p * -1 : p),
    (P = 1 - p);
  if (!f || !t) return null;
  if (l) (r = m(P * f.r + p * t.r)), (g = m(P * f.g + p * t.g)), (b = m(P * f.b + p * t.b));
  else
    (r = m((P * f.r ** 2 + p * t.r ** 2) ** 0.5)),
      (g = m((P * f.g ** 2 + p * t.g ** 2) ** 0.5)),
      (b = m((P * f.b ** 2 + p * t.b ** 2) ** 0.5));
  (a = f.a),
    (t = t.a),
    (f = a >= 0 || t >= 0),
    (a = f ? (a < 0 ? t : t < 0 ? a : a * P + t * p) : 0);
  if (h)
    return (
      'rgb' + (f ? 'a(' : '(') + r + ',' + g + ',' + b + (f ? ',' + m(a * 1000) / 1000 : '') + ')'
    );
  else
    return (
      '#' +
      (4294967296 + r * 16777216 + g * 65536 + b * 256 + (f ? m(a * 255) : 0))
        .toString(16)
        .slice(1, f ? undefined : -2)
    );
}

globalThis.pSBC = pSBC;

export function rgba(c: string, p: number) {
  const f = pSBCr(c) || { r: 0, g: 0, b: 0 };
  if (f.a > 0) {
    return `rgba(${f.r},${f.g},${f.b},${f.a * p})`;
  }

  return `rgba(${f.r},${f.g},${f.b},${p})`;
}

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
