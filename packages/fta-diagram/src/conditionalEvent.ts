export function conditionalEvent(
  pen: any,
  path?: CanvasRenderingContext2D | Path2D
) {
  if (!path) {
    path = new Path2D();
  }

  let myh = pen.calculative.worldRect.height / 2;
  let myw = pen.calculative.worldRect.width / 5;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x, y + myh);
  path.lineTo(x + myw, y + myh);
  path.moveTo(x + myw * 5, y + myh);
  path.ellipse(x + myw * 3, y + myh, 2 * myw, myh, 0, 0, Math.PI * 2);

  path.closePath();

  return path;
}

export function conditionalEventAnchors(pen: any) {
  const anchors: any[] = [];
  anchors.push({
    id: '3',
    penId: pen.id,
    x: 0,
    y: 0.5,
  });
  anchors.push({
    id: '0',
    penId: pen.id,
    x: 3 / 5,
    y: 0,
  });
  anchors.push({
    id: '2',
    penId: pen.id,
    x: 3 / 5,
    y: 1,
  });
  anchors.push({
    id: '1',
    penId: pen.id,
    x: 1,
    y: 0.5,
  });

  pen.anchors = anchors;
}
