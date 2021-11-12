import { Pen } from '../pen';

export function message(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!pen.onDestroy) {
    pen.onResize = onResize;
  }
  if (!path) {
    path = new Path2D();
  }

  pen.textTop = 0;
  pen.calculative.textTop = 0;
  pen.calculative.worldTextRect.height =
    (pen.calculative.worldRect.height * 3) / 4;
  pen.textHeight = (pen.calculative.worldRect.height * 3) / 4;
  pen.calculative.textHeight = (pen.calculative.worldRect.height * 3) / 4;
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y);
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 3) / 4
  );
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width * 8) / 16,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 3) / 4
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 4,
    pen.calculative.worldRect.ey
  );
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width * 5) / 16,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 3) / 4
  );
  path.lineTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 3) / 4
  );

  path.closePath();

  return path;
}

function onResize(pen: Pen) {
  pen.textTop = 0;
  pen.calculative.textTop = 0;
  pen.calculative.worldTextRect.height =
    (pen.calculative.worldRect.height * 3) / 4;
  pen.textHeight = (pen.calculative.worldRect.height * 3) / 4;
  pen.calculative.textHeight = (pen.calculative.worldRect.height * 3) / 4;
}
