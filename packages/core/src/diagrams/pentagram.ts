import { Pen } from '../pen';
import { Point } from '../point';

export function pentagram(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!pen.onDestroy) {
    pen.onAdd = onAdd;
  }

  if (!path) {
    path = new Path2D();
  }

  let r =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? pen.calculative.worldRect.height
      : pen.calculative.worldRect.width;
  let centerx =
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2; //旋转中心点
  let centery =
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2;
  let basex = centerx;
  let basey = centery - r / 2;
  let basexi = centerx;
  let baseyi = centery - r / 4;

  let lx =
    (basexi - centerx) * Math.cos((Math.PI / 180) * 324) -
    (baseyi - centery) * Math.sin((Math.PI / 180) * 324) +
    centerx;
  let ly =
    (basexi - centerx) * Math.sin((Math.PI / 180) * 324) +
    (baseyi - centery) * Math.cos((Math.PI / 180) * 324) +
    centery;
  path.moveTo(lx, ly);
  for (let i = 0; i < 5; ++i) {
    path.lineTo(
      (basex - centerx) * Math.cos((Math.PI / 180) * 72 * i) -
        (basey - centery) * Math.sin((Math.PI / 180) * 72 * i) +
        centerx,
      (basex - centerx) * Math.sin((Math.PI / 180) * 72 * i) +
        (basey - centery) * Math.cos((Math.PI / 180) * 72 * i) +
        centery
    );
    path.lineTo(
      (lx - centerx) * Math.cos((Math.PI / 180) * 72 * (i + 1)) -
        (ly - centery) * Math.sin((Math.PI / 180) * 72 * (i + 1)) +
        centerx,
      (lx - centerx) * Math.sin((Math.PI / 180) * 72 * (i + 1)) +
        (ly - centery) * Math.cos((Math.PI / 180) * 72 * (i + 1)) +
        centery
    );
  }
  path.closePath();

  return path;
}

function onAdd(pen: Pen) {
  let r =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? pen.calculative.worldRect.height
      : pen.calculative.worldRect.width;
  let centerx =
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2; //旋转中心点
  let centery =
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2;
  let basex = centerx;
  let basey = centery - r / 2;

  const anchors: Point[] = [];

  for (let i = 0; i < 5; ++i) {
    anchors.push({
      id: '0',
      penId: pen.id,
      x:
        ((basex - centerx) * Math.cos((Math.PI / 180) * 72 * i) -
          (basey - centery) * Math.sin((Math.PI / 180) * 72 * i) +
          centerx -
          pen.calculative.worldRect.x) /
        pen.calculative.width,
      y:
        ((basex - centerx) * Math.sin((Math.PI / 180) * 72 * i) +
          (basey - centery) * Math.cos((Math.PI / 180) * 72 * i) +
          centery -
          pen.calculative.y) /
        pen.calculative.height,
    });
  }
  pen.anchors = anchors;
}
