import { ChartPen, getColors, getNumericValue, getSeries } from './common';
import { drawAxis } from './axis';

/** 绘制折线图，支持多序列、平滑曲线和数据点描边。 */
export function lineChart(ctx: CanvasRenderingContext2D, pen: ChartPen) {
  const { rect, range } = drawAxis(ctx, pen);
  const series = getSeries(pen);
  if (!series.length) return;
  const colors = getColors(pen);
  const count = Math.max(pen.xAxisData?.length || 0, ...series.map((item) => item.length), 1);
  const min = range.min ?? 0;
  const max = range.max ?? 1;
  const valueToPoint = (value: number, index: number) => ({
    x: rect.x + ((index + 0.5) * rect.width) / count,
    y: rect.y + rect.height - ((value - min) / Math.max(max - min, Number.EPSILON)) * rect.height,
  });
  series.forEach((values, seriesIndex) => {
    const points = values.map((item, index) => valueToPoint(getNumericValue(item), index));
    if (!points.length) return;
    ctx.save();
    ctx.strokeStyle = colors[seriesIndex % colors.length];
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Math.max(1, pen.lineWidth || 2);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (pen.smooth && points.length > 2) {
      for (let index = 0; index < points.length - 1; index++) {
        const current = points[index];
        const next = points[index + 1];
        const previous = points[index - 1] || current;
        const after = points[index + 2] || next;
        const cp1 = { x: current.x + (next.x - previous.x) / 4, y: current.y + (next.y - previous.y) / 4 };
        const cp2 = { x: next.x - (after.x - current.x) / 4, y: next.y - (after.y - current.y) / 4 };
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, next.x, next.y);
      }
    } else {
      points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    }
    ctx.stroke();
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(2, (pen.lineWidth || 2) * 1.5), 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = colors[seriesIndex % colors.length];
      ctx.stroke();
    });
    ctx.restore();
  });
}
