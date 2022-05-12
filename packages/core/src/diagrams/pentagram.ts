import { Pen } from '../pen';
import { Point } from '../point';

export function pentagram(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  if (!pen.onResize) {
    pen.onResize = resize;
  }
  const path = !ctx ? new Path2D() : ctx;
  const { width, height, center } = pen.calculative.worldRect;

  const r = width > height ? height : width;
  //旋转中心点
  const centerx = center.x;
  const centery = center.y;
  const basey = centery - r / 2;
  const baseyi = centery - r / 4;

  const lx = -(baseyi - centery) * Math.sin((Math.PI / 180) * 324) + centerx;
  const ly = (baseyi - centery) * Math.cos((Math.PI / 180) * 324) + centery;
  path.moveTo(lx, ly);
  for (let i = 0; i < 5; ++i) {
    // TODO: Math.sin Math.cos 考虑优化下
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
  if (path instanceof Path2D) return path;
}

export function pentagramAnchors(pen: Pen) {
  // TODO: 组合状态下的 width height 成了固定的百分比
  const { width, height } = pen;
  const r = width > height ? height : width;
  const anchors: Point[] = [];

  for (let i = 0; i < 5; ++i) {
    anchors.push({
      flag: 1, // 默认锚点
      id: String(i),
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
