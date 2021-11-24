import { calcWorldAnchors, Pen } from '../pen';
import { Point } from '../point';

export function pentagram(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!pen.onDestroy) {
    pen.onResize = resize;
  }

  if (!path) {
    path = new Path2D();
  }

  const r =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? pen.calculative.worldRect.height
      : pen.calculative.worldRect.width;
  const centerx =
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2; //旋转中心点
  const centery =
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2;
  const basey = centery - r / 2;
  const baseyi = centery - r / 4;

  const lx = -(baseyi - centery) * Math.sin((Math.PI / 180) * 324) + centerx;
  const ly = (baseyi - centery) * Math.cos((Math.PI / 180) * 324) + centery;
  path.moveTo(lx, ly);
  for (let i = 0; i < 5; ++i) {
    path.lineTo(
      -(basey - centery) * Math.sin((Math.PI / 180) * 72 * i) + centerx,
      (basey - centery) * Math.cos((Math.PI / 180) * 72 * i) + centery
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

export function pentagramAnchors(pen: Pen) {
  const { width, height } = pen;
  const r = width > height ? height : width;
  const anchors: Point[] = [];

  for (let i = 0; i < 5; ++i) {
    anchors.push({
      flag: 1,    // 默认锚点
      id: '0',
      penId: pen.id,
      x: 0.5 + ((r / 2) * Math.sin((Math.PI / 180) * 72 * i)) / width,
      y: ((-r / 2) * Math.cos((Math.PI / 180) * 72 * i)) / height + 0.5,
    });
  }
  pen.anchors = anchors;
}

function resize(pen: Pen) {
  // 过滤出非默认锚点，即自定义锚点
  const manualPoints = pen.anchors.filter((point: Point) => point.flag !== 1);
  pentagramAnchors(pen);
  pen.anchors = pen.anchors.concat(...manualPoints);
}
