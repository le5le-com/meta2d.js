import { Pen } from './model';
import { Point } from '../point';
import { calcRightBottom, Rect } from '../rect';
import { t } from '../locale';

/**
 * 曲线文字排版
 * pen.textCurve 为用户自定义的轨迹点，坐标为相对文字区域（worldTextRect）的 0~1 比例，
 * 文字沿平滑经过所有轨迹点的曲线排列
 */

interface Sample {
  x: number;
  y: number;
  len: number; // 从起点开始的累计长度
}

/** 曲线上单个字符的绘制信息（世界坐标） */
export interface CurveGlyph {
  ch: string;
  x: number;
  y: number;
  angle: number;
}

// 每两个轨迹点之间的采样数
const SEGMENT_SAMPLES = 20;

/** 将轨迹点转换为世界坐标，并用 Catmull-Rom 平滑采样 */
function sampleCurve(curve: Point[], rect: Rect): Point[] {
  const ctrl = curve.map((p) => ({
    x: rect.x + p.x * rect.width,
    y: rect.y + p.y * rect.height,
  }));
  if (ctrl.length === 2) {
    return ctrl;
  }
  const points: Point[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[i - 1] || ctrl[i];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[i + 2] || p2;
    for (let j = i === 0 ? 0 : 1; j <= SEGMENT_SAMPLES; j++) {
      const s = j / SEGMENT_SAMPLES;
      const s2 = s * s;
      const s3 = s2 * s;
      points.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * s + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * s + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3),
      });
    }
  }
  return points;
}

function buildSamples(points: Point[]): Sample[] {
  const samples: Sample[] = [];
  let len = 0;
  points.forEach((p, i) => {
    if (i > 0) {
      const prev = points[i - 1];
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
    }
    samples.push({ x: p.x, y: p.y, len });
  });
  return samples;
}

/** 根据长度获取曲线上的点与切线角度，超出范围时沿首尾切线延伸 */
function getPointAt(samples: Sample[], total: number, d: number) {
  let i = 1;
  if (d >= total) {
    i = samples.length - 1;
  } else if (d > 0) {
    // 二分查找所在线段
    let lo = 1;
    let hi = samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].len < d) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    i = lo;
  }
  const a = samples[i - 1];
  const b = samples[i];
  const segLen = b.len - a.len || 1;
  const k = (d - a.len) / segLen;
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

/**
 * 计算曲线文字布局：
 * 1. 按 textAlign 沿曲线排列每个字符
 * 2. 计算所有字符（含旋转）的包围盒
 * 3. 按 textAlign / textBaseline 将包围盒对齐到 worldTextRect 内
 * 结果写入 calculative.textCurveGlyphs 与 calculative.textDrawRect
 * 调用前需已设置 ctx.font
 */
export function calcCurveTextLayout(ctx: CanvasRenderingContext2D, pen: Pen) {
  const calc = pen.calculative;
  const rect = calc.worldTextRect;
  const text = (calc.textLines || []).join('');
  calc.textCurveGlyphs = [];
  calc.textCurveFont = ctx.font;
  if (!rect || !text || !(pen.textCurve?.length >= 2)) {
    calc.textDrawRect = { x: rect?.x || 0, y: rect?.y || 0, width: 0, height: 0 };
    calcRightBottom(calc.textDrawRect);
    return;
  }

  const { options } = calc.canvas.store;
  const textAlign = pen.textAlign || options.textAlign;
  const textBaseline = pen.textBaseline || options.textBaseline;

  const samples = buildSamples(sampleCurve(pen.textCurve, rect));
  const total = samples[samples.length - 1].len;

  const spacing = calc.letterSpacing || 0;
  const chars = Array.from(t(text));
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const textWidth =
    widths.reduce((sum, cw) => sum + cw, 0) + spacing * (chars.length - 1);

  // 沿曲线方向的起始位置
  let start = 0;
  if (textAlign === 'center') {
    start = (total - textWidth) / 2;
  } else if (textAlign === 'right') {
    start = total - textWidth;
  }

  const halfH = (calc.fontSize * (calc.lineHeight || 1)) / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let pos = start;
  chars.forEach((ch, i) => {
    const cw = widths[i];
    const p = getPointAt(samples, total, pos + cw / 2);
    calc.textCurveGlyphs.push({ ch, x: p.x, y: p.y, angle: p.angle });
    // 旋转后字符矩形的四个角
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);
    const halfW = cw / 2;
    for (const [dx, dy] of [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH],
    ]) {
      const cx = p.x + dx * cos - dy * sin;
      const cy = p.y + dx * sin + dy * cos;
      minX = Math.min(minX, cx);
      minY = Math.min(minY, cy);
      maxX = Math.max(maxX, cx);
      maxY = Math.max(maxY, cy);
    }
    pos += cw + spacing;
  });

  // 包围盒按对齐方式放入文字区域
  const width = maxX - minX;
  const height = maxY - minY;
  let x = rect.x + (rect.width - width) / 2;
  if (textAlign === 'left') {
    x = rect.x;
  } else if (textAlign === 'right') {
    x = rect.x + rect.width - width;
  }
  let y = rect.y + (rect.height - height) / 2;
  if (textBaseline === 'top') {
    y = rect.y;
  } else if (textBaseline === 'bottom') {
    y = rect.y + rect.height - height;
  }
  const offsetX = x - minX;
  const offsetY = y - minY;
  calc.textCurveGlyphs.forEach((g) => {
    g.x += offsetX;
    g.y += offsetY;
  });

  calc.textDrawRect = { x, y, width, height };
  calcRightBottom(calc.textDrawRect);
}

/**
 * 绘制曲线文字，调用前需已设置 ctx.font / ctx.fillStyle，并已计算布局
 */
export function drawCurveText(ctx: CanvasRenderingContext2D, pen: Pen) {
  const glyphs = pen.calculative.textCurveGlyphs;
  if (!glyphs?.length) {
    return;
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const g of glyphs) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);
    ctx.fillText(g.ch, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/** 是否启用曲线排版（至少 2 个轨迹点） */
export function isCurveText(pen: Pen) {
  return Array.isArray(pen.textCurve) && pen.textCurve.length >= 2;
}
