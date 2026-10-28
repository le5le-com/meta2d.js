import { ChartPen, getColors, getNumericValue, getSeries } from './common';
import { drawAxis } from './axis';

/** 绘制分组柱状图。 */
export function histogram(ctx: CanvasRenderingContext2D, pen: ChartPen) {
  const { rect, range } = drawAxis(ctx, pen);
  const series = getSeries(pen);
  if (!series.length) return;
  const colors = getColors(pen);
  const count = Math.max(pen.xAxisData?.length || 0, ...series.map((item) => item.length), 1);
  const groupWidth = rect.width / count;
  const barWidth = (groupWidth * 0.8) / series.length;
  const min = range.min || 0;
  const max = range.max || 1;
  const span = Math.max(max - min, Number.EPSILON);
  const baseline = rect.y + rect.height - ((0 - min) / span) * rect.height;
  series.forEach((values, seriesIndex) => {
    ctx.save();
    ctx.fillStyle = colors[seriesIndex % colors.length];
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, pen.lineWidth || 1);
    values.forEach((item, index) => {
      const valueY = rect.y + rect.height - ((getNumericValue(item) - min) / span) * rect.height;
      const y = Math.min(baseline, valueY);
      const height = Math.abs(valueY - baseline);
      const x = rect.x + index * groupWidth + groupWidth * 0.1 + seriesIndex * barWidth;
      ctx.beginPath();
      ctx.rect(x, y, Math.max(1, barWidth - 1), Math.max(0, height - 1));
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  });
}
