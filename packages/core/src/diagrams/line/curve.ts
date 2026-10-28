import { Pen } from '../../models';
import { fromArrow, toArrow } from './arrow';

export function curve(
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  options?: any,
  data?: any
) {
  if (!pen.anchors || pen.anchors.length < 2) {
    return;
  }


  ctx.beginPath();
  const first = pen.anchors[0];
  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < pen.anchors.length; i++) {
    const from = pen.anchors[i - 1];
    const to = pen.anchors[i];

    if (from.cp1) {
      if (to.cp2) {
        ctx.bezierCurveTo(from.cp1.x, from.cp1.y, to.cp2.x, to.cp2.y, to.x, to.y);
      } else {
        ctx.quadraticCurveTo(from.cp1.x, from.cp1.y, to.x, to.y);
      }
    } else {
      if (to.cp2) {
        ctx.quadraticCurveTo(to.cp2.x, to.cp2.y, to.x, to.y);
      } else {
        ctx.lineTo(to.x, to.y);
      }
    }
  }

  if (pen.close && pen.anchors.length > 2) {
    const last = pen.anchors[pen.anchors.length - 1];

    if (last.cp1) {
      if (first.cp2) {
        ctx.bezierCurveTo(last.cp1.x, last.cp1.y, first.cp2.x, first.cp2.y, first.x, first.y);
      } else {
        ctx.quadraticCurveTo(last.cp1.x, last.cp1.y, first.x, first.y);
      }
    } else {
      if (first.cp2) {
        ctx.quadraticCurveTo(first.cp2.x, first.cp2.y, first.x, first.y);
      } else {
        ctx.lineTo(first.x, first.y);
      }
    }
  }
  ctx.stroke();

  if (pen.fromArrow) {
    fromArrow(ctx, pen);
  }
  if (pen.toArrow) {
    toArrow(ctx, pen);
  }
}

/** mind 连线使用 1.0 的 mind 控制柄规则，路径绘制与普通曲线保持一致。 */
export function mind(ctx: CanvasRenderingContext2D, pen: Pen, options?: any, data?: any) {
  curve(ctx, pen, options, data);
}
