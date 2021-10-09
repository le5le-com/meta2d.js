import { Pen } from '../pen';

export function cloud(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }

  path.moveTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 5,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 13) / 16
  );
  path.bezierCurveTo(
    pen.calculative.worldRect.x - pen.calculative.worldRect.width / 15,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 13) / 16,
    pen.calculative.worldRect.x - pen.calculative.worldRect.width / 15,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 7) / 16,
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 5,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 7) / 16
  );
  path.bezierCurveTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 5,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width * 4) / 5,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width * 4) / 5,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 7) / 16
  );
  path.bezierCurveTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width * 16) / 15,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 7) / 16,
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width * 16) / 15,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 13) / 16,
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width * 4) / 5,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 13) / 16
  );
  path.closePath();

  return path;
}
