import { Pen } from '../pen';

export function leftArrow(pen: Pen, path?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }

  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2);
  path.lineTo(pen.calculative.worldRect.x + pen.calculative.worldRect.height / 2, pen.calculative.worldRect.y);
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.height / 2,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 3
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 3
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 2) / 3
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.height / 2,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 2) / 3
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.height / 2,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 2) / 3
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.height / 2,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height
  );
  path.closePath();

  return path;
}

export function rightArrow(pen: Pen, path?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }

  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + pen.calculative.worldRect.height / 3);
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width - pen.calculative.worldRect.height / 2),
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 3
  );
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width - pen.calculative.worldRect.height / 2),
    pen.calculative.worldRect.y
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2
  );
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width - pen.calculative.worldRect.height / 2),
    pen.calculative.worldRect.y + pen.calculative.worldRect.height
  );
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width - pen.calculative.worldRect.height / 2),
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 2) / 3
  );
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 2) / 3);

  path.closePath();

  return path;
}

export function twowayArrow(pen: Pen, path?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }

  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2);
  path.lineTo(pen.calculative.worldRect.x + pen.calculative.worldRect.height / 2, pen.calculative.worldRect.y);
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.height / 2,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 3
  );
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width - pen.calculative.worldRect.height / 2),
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 3
  );
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width - pen.calculative.worldRect.height / 2),
    pen.calculative.worldRect.y
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2
  );
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width - pen.calculative.worldRect.height / 2),
    pen.calculative.worldRect.y + pen.calculative.worldRect.height
  );
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width - pen.calculative.worldRect.height / 2),
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 2) / 3
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.height / 2,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 2) / 3
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.height / 2,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height
  );
  path.closePath();

  return path;
}
