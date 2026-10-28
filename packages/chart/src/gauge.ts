import type { Meta2d, Pen } from '@meta2d/core';
import { ChartPen, getColors } from './common';

type TimerHandle = ReturnType<typeof setInterval>;
const clockTimers = new Map<string, TimerHandle>();
const clockStarting = new Set<string>();

export const gaugeDefine = {
  type: 'gauge',
  draw: gauge,
  create,
  afterUpdate,
  destroy,
};

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function degreeToRadian(value: number): number {
  return (value * Math.PI) / 180;
}

interface ArcConfig {
  start: number;
  sweep: number;
  anticlockwise: boolean;
}

/** 统一 Canvas 顺时针坐标系下的起点和弧长。 */
function getArcConfig(startAngle: number, endAngle: number): ArcConfig {
  const start = degreeToRadian(-startAngle);
  const rawEnd = degreeToRadian(-endAngle);
  let sweep = rawEnd - start;
  // 1.0 使用 90 到 -270 表示完整圆，保留完整 2π 而不是归一化成零。
  if (Math.abs(Math.abs(startAngle - endAngle) - 360) < 1e-6) {
    sweep = startAngle > endAngle ? Math.PI * 2 : -Math.PI * 2;
  } else {
    while (sweep <= 0) sweep += Math.PI * 2;
    if (sweep > Math.PI * 2) sweep %= Math.PI * 2;
  }
  return { start, sweep, anticlockwise: sweep < 0 };
}

interface AxisSegment {
  end: number;
  color: string;
}

function getAxisSegments(pen: ChartPen): AxisSegment[] {
  const source = Array.isArray(pen.axisLine) ? pen.axisLine : [];
  return source
    .map(([ratio, color]) => ({ end: Math.min(1, Math.max(0, finite(ratio, 0))), color: color || '#1890ff' }))
    .filter((item) => Number.isFinite(item.end))
    .sort((a, b) => a.end - b.end);
}

function getPointerColor(pen: ChartPen, value: number, min: number, max: number, colors: string[]): string {
  const segments = getAxisSegments(pen);
  if (!segments.length) return colors[0] || '#1890ff';
  const ratio = Math.min(1, Math.max(0, (value - min) / Math.max(max - min, Number.EPSILON)));
  return (segments.find((segment) => ratio <= segment.end) || segments[segments.length - 1]).color;
}

function drawArc(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, arc: ArcConfig, from: number, to: number) {
  const start = arc.start + arc.sweep * from;
  const end = arc.start + arc.sweep * to;
  ctx.beginPath();
  ctx.arc(x, y, radius, start, end, arc.anticlockwise);
  ctx.stroke();
}

/** 绘制 1.0 风格的仪表盘和时钟。 */
export function gauge(ctx: CanvasRenderingContext2D, pen: ChartPen) {
  const width = Math.max(1, finite(pen.width, 1));
  const height = Math.max(1, finite(pen.height, 1));
  const centerX = finite(pen.x, 0) + width / 2;
  const centerY = finite(pen.y, 0) + height / 2;
  const radius = Math.max(1, Math.min(width, height) * 0.45);
  const startAngle = finite(pen.startAngle, 225);
  const endAngle = finite(pen.endAngle, -45);
  const arc = getArcConfig(startAngle, endAngle);
  const configuredMin = finite(pen.min, 0);
  const configuredMax = finite(pen.max, 100);
  // 非法的反向范围按升序处理，避免比例计算得到负值或 NaN。
  const min = Math.min(configuredMin, configuredMax);
  const safeMax = Math.max(configuredMin, configuredMax) === min ? min + 1 : Math.max(configuredMin, configuredMax);
  const scale = Math.max(0.1, finite((pen.calculative as { scale?: number } | undefined)?.scale, 1));
  const colors = getColors(pen);
  const backgroundWidth = Math.max(2, radius / 10);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = backgroundWidth;
  ctx.strokeStyle = pen.background || '#e6ebf8';
  drawArc(ctx, centerX, centerY, radius, arc, 0, 1);

  let pointerColor = colors[0] || '#1890ff';
  if (!pen.isClock) {
    const segments = getAxisSegments(pen);
    const value = Math.min(safeMax, Math.max(min, finite(pen.value, min)));
    const valueRatio = Math.min(1, Math.max(0, (value - min) / Math.max(safeMax - min, Number.EPSILON)));
    // 这里保持 1.0 的倒序覆盖绘制：每段都从起点绘制到当前值或该段阈值。
    // 后绘制的低阈值区间会覆盖前面较高阈值区间，最终形成连续的分段颜色。
    for (let index = segments.length - 1; index >= 0; index--) {
      const segment = segments[index];
      const segmentEnd = Math.min(segment.end, valueRatio);
      if (segmentEnd <= 0) continue;
      ctx.strokeStyle = segment.color;
      drawArc(ctx, centerX, centerY, radius, arc, 0, segmentEnd);
    }
    pointerColor = getPointerColor(pen, value, min, safeMax, colors);
  }

  // 主刻度和次刻度使用弧长计算，避免小图元出现负数虚线间距。
  const mainRadius = Math.max(0, radius - backgroundWidth);
  const arcLength = Math.abs(arc.sweep) * mainRadius;
  const splitNumber = Math.max(1, Math.min(100, Math.round(finite(pen.splitNumber, 10))));
  const mainDashWidth = Math.max(1, 2 * scale);
  const mainDashGap = Math.max(0, (arcLength - mainDashWidth * splitNumber) / splitNumber);
  ctx.lineCap = 'butt';
  ctx.lineWidth = Math.max(1, radius / 20);
  ctx.strokeStyle = pen.color || '#999999';
  ctx.setLineDash([mainDashWidth, mainDashGap]);
  drawArc(ctx, centerX, centerY, mainRadius, arc, 0, 1);

  const minorRadius = mainRadius;
  const minorDashWidth = Math.max(1, scale);
  const minorCount = splitNumber * 5;
  const minorArcLength = Math.abs(arc.sweep) * minorRadius;
  const minorDashGap = Math.max(0, (minorArcLength - minorDashWidth * minorCount) / minorCount);
  ctx.lineWidth = Math.max(1, radius / 40);
  ctx.setLineDash([minorDashWidth, minorDashGap]);
  drawArc(ctx, centerX, centerY, minorRadius, arc, 0, 1);
  ctx.setLineDash([]);

  const tickLabel = pen.tickLabel;
  if (tickLabel?.show !== false) {
    // 刻度文字位置保持 1.0：文字半径位于主刻度内侧一个半径宽度。
    const textRadius = Math.max(0, radius - backgroundWidth - radius / 20);
    ctx.fillStyle = tickLabel?.color || '#999999';
    ctx.font = `${Math.max(1, finite(tickLabel?.fontSize, finite(pen.fontSize, 12))) * scale}px ${tickLabel?.fontFamily || pen.fontFamily || 'Arial'}`;
    for (let index = 0; index <= splitNumber; index++) {
      if (Math.abs(Math.abs(startAngle - endAngle) - 360) < 1e-6 && index === 0) continue;
      // 使用 1.0 的角度公式，避免经过弧度归一化后文字位置产生偏移。
      const angle = startAngle - (index / splitNumber) * (startAngle - endAngle);
      const angleRadian = degreeToRadian(angle);
      const cosine = Math.cos(angleRadian);
      const sine = Math.sin(angleRadian);
      // 这里的对齐方向与 1.0 保持一致（左右方向看似反直觉，但对应原版视觉位置）。
      ctx.textAlign = cosine > 0.02 ? 'end' : cosine < -0.02 ? 'start' : 'center';
      ctx.textBaseline = sine > 0.02 ? 'top' : sine < -0.02 ? 'bottom' : 'middle';
      const number = min + ((safeMax - min) * index) / splitNumber;
      ctx.fillText(String(Math.round(number * 1000) / 1000), centerX + textRadius * cosine, centerY - textRadius * sine);
    }
  }

  if (pen.isClock) {
    const hour = finite(pen.hourvalue, 0);
    const minute = finite(pen.minutevalue, 0);
    const second = finite(pen.secondvalue, 0);
    drawPointer(ctx, centerX, centerY, radius * 0.5, degreeToRadian(hour * 30 - 90), pen.color || '#333');
    drawPointer(ctx, centerX, centerY, radius * 0.7, degreeToRadian(minute * 6 - 90), pen.color || '#555');
    drawPointer(ctx, centerX, centerY, radius * 0.8, degreeToRadian(second * 6 - 90), '#f04864');
  } else {
    const value = Math.min(safeMax, Math.max(min, finite(pen.value, min)));
    drawPointer(ctx, centerX, centerY, radius * 0.8, arc.start + arc.sweep * ((value - min) / Math.max(safeMax - min, Number.EPSILON)), pointerColor);
  }

  const title = pen.titleLabel;
  ctx.fillStyle = title?.color || pointerColor;
  ctx.font = `${Math.max(1, finite(title?.fontSize, finite(pen.fontSize, 16))) * scale}px ${title?.fontFamily || pen.fontFamily || 'Arial'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const clockText = `${String(Math.floor(finite(pen.hourvalue, 0))).padStart(2, '0')}:${String(Math.floor(finite(pen.minutevalue, 0))).padStart(2, '0')}:${String(Math.floor(finite(pen.secondvalue, 0))).padStart(2, '0')}`;
  const valueText = `${Math.round(finite(pen.value, min) * 1000) / 1000} ${pen.unit || ''}`.trim();
  ctx.fillText(pen.isClock ? clockText : valueText, centerX, centerY + radius * 0.55);
  if (pen.isClock) {
    ctx.fillStyle = pen.color || '#999999';
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(2, radius / 20), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPointer(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, angle: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function readClock(meta2d: Meta2d, id: string): ChartPen | undefined {
  return (meta2d as Meta2d & { penMap?: Map<string, Pen> }).penMap?.get(id) as ChartPen | undefined;
}

function scheduleClock(meta2d: Meta2d, pen: ChartPen) {
  if (!pen.id || clockTimers.has(pen.id) || clockStarting.has(pen.id)) return;
  clockStarting.add(pen.id);
  // 等待 add 补丁完成后再启动，避免 create 阶段 setValue 找不到 pen。
  setTimeout(() => {
    clockStarting.delete(pen.id as string);
    const current = readClock(meta2d, pen.id as string);
    if (!current?.isClock) return;
    const update = () => {
      const latest = readClock(meta2d, pen.id as string);
      if (!latest?.isClock) {
        stopClock(pen.id as string);
        return;
      }
      const date = new Date();
      const second = date.getSeconds();
      const minute = date.getMinutes() + second / 60;
      const hour = (date.getHours() % 12) + minute / 60;
      meta2d.setValue({ id: pen.id, hourvalue: hour, minutevalue: minute, secondvalue: second }, { preventEvent: true, render: true });
    };
    update();
    clockTimers.set(pen.id as string, setInterval(update, 1000));
  }, 0);
}

function stopClock(id?: string) {
  if (!id) return;
  const timer = clockTimers.get(id);
  if (timer) clearInterval(timer);
  clockTimers.delete(id);
  clockStarting.delete(id);
}

function create(this: Meta2d, pen: ChartPen) {
  stopClock(pen.id);
  if (pen.isClock) scheduleClock(this, pen);
}

function afterUpdate(this: Meta2d, pen: ChartPen, value: Record<string, unknown>) {
  if (Object.prototype.hasOwnProperty.call(value, 'isClock')) {
    stopClock(pen.id);
    if (pen.isClock) scheduleClock(this, pen);
  }
}

function destroy(this: Meta2d, pen: Pen) {
  stopClock(pen.id);
}
