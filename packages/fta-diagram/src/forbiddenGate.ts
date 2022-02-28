export function forbiddenGate(
  pen: any,
  path?: CanvasRenderingContext2D | Path2D
) {
  if (!path) {
    path = new Path2D();
  }

  let myh = pen.calculative.worldRect.height / 8;
  let myw = 0.25 * pen.calculative.worldRect.width;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + myw * 2, y);
  path.lineTo(x + myw * 2, y + myh * 2);
  path.lineTo(x + myw * 3, y + myh * 3);
  path.lineTo(x + myw * 3, y + myh * 5);
  path.lineTo(x + myw * 2, y + myh * 6);
  path.lineTo(x + myw * 1, y + myh * 5);
  path.lineTo(x + myw * 1, y + myh * 3);
  path.lineTo(x + myw * 2, y + myh * 2);
  path.moveTo(x + myw * 3, y + myh * 4);
  path.lineTo(x + myw * 4, y + myh * 4);
  path.moveTo(x + myw * 2, y + myh * 6);
  path.lineTo(x + myw * 2, y + myh * 8);

  path.closePath();

  return path;
}

export function forbiddenGateAnchors(pen: any) {
  const anchors: any[] = [];
  anchors.push({
    id: '0',
    penId: pen.id,
    x: 0.5,
    y: 0,
  });

  anchors.push({
    id: '1',
    penId: pen.id,
    x: 1,
    y: 0.5,
  });

  anchors.push({
    id: '2',
    penId: pen.id,
    x: 0.5,
    y: 1,
  });

  pen.anchors = anchors;
}
