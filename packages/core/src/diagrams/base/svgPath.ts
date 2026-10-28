import { Pen, Rect } from '../../models';

export function svgPath(ctx: CanvasRenderingContext2D, pen: Pen, path: any, pathRect: Rect) {
  if (!path || !pathRect?.width || !pathRect?.height) {
    return;
  }

  ctx.save();
  const path2D = new Path2D(path);
  const scaleX = pen.width / pathRect.width;
  const scaleY = pen.height / pathRect.height;
  ctx.translate(pen.x - pathRect.x * scaleX, pen.y - pathRect.y * scaleY);
  ctx.scale(scaleX, scaleY);
  if (pen.pathFill) {
    const fillStyle = ctx.fillStyle;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill(path2D);
    ctx.fillStyle = fillStyle;
    ctx.restore();
    return;
  }

  ctx.stroke(path2D);

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill(path2D);
    }
  }
  ctx.restore();
}
