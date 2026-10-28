import { ChartPen, getColors, getItemName, getNumericValue, getSeries, parseRadius } from './common';

/** 绘制单环或多环饼图，并支持标签及引导线。 */
export function pieChart(ctx: CanvasRenderingContext2D, pen: ChartPen) {
  const series = getSeries(pen);
  if (!series.length) return;
  const colors = getColors(pen);
  const centerX = pen.x + pen.width / 2;
  const centerY = pen.y + pen.height / 2;
  const baseRadius = Math.min(pen.width, pen.height) / 2;
  let colorIndex = 0;
  series.forEach((items, seriesIndex) => {
    const radius = pen.chartsRadius?.[seriesIndex] || [];
    const inner = parseRadius(radius[0], baseRadius, series.length > 1 ? (baseRadius * seriesIndex) / series.length : 0);
    const outer = parseRadius(radius[1], baseRadius, (baseRadius * (seriesIndex + 1)) / series.length);
    if (outer <= inner) return;
    const total = items.reduce<number>((sum, item) => sum + Math.max(0, getNumericValue(item)), 0);
    if (!total) return;
    let start = -Math.PI / 2;
    items.forEach((item) => {
      const value = Math.max(0, getNumericValue(item));
      const end = start + (value / total) * Math.PI * 2;
      const color = colors[colorIndex++ % colors.length];
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, outer, start, end);
      ctx.arc(centerX, centerY, inner, end, start, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1, pen.lineWidth || 2);
      ctx.fill();
      ctx.stroke();
      const angle = (start + end) / 2;
      const labelLine = pen.tickLabel?.labelLine?.show !== false;
      const showLabel = pen.tickLabel?.show !== false;
      const inside = !!(pen.tickLabel as any)?.position && ['inner', 'inside'].includes((pen.tickLabel as any).position);
      const labelRadius = inside ? (inner + outer) / 2 : outer + 10;
      const lx = centerX + labelRadius * Math.cos(angle);
      const ly = centerY + labelRadius * Math.sin(angle);
      if (!inside && labelLine) {
        ctx.beginPath();
        ctx.moveTo(centerX + outer * Math.cos(angle), centerY + outer * Math.sin(angle));
        ctx.lineTo(lx, ly);
        ctx.strokeStyle = color;
        ctx.stroke();
      }
      if (showLabel) {
        ctx.fillStyle = inside ? '#fff' : pen.tickLabel?.color || pen.color || '#666';
        ctx.font = `${pen.tickLabel?.fontSize || pen.fontSize || 12}px ${pen.tickLabel?.fontFamily || pen.fontFamily || 'Arial'}`;
        ctx.textAlign = Math.cos(angle) < 0 ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(getItemName(item, 0), lx + (inside ? 0 : Math.cos(angle) < 0 ? -5 : 5), ly);
      }
      ctx.restore();
      start = end;
    });
  });
}
