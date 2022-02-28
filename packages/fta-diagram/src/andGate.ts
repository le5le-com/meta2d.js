export function andGate(pen: any, path?: CanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }

  let myh = pen.calculative.worldRect.height / 6;
  let myw = pen.calculative.worldRect.width / 4;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + myw * 2, y + 0);
  path.lineTo(x + myw * 2, y + myh);
  path.moveTo(x, y + myh + myw * 2);
  path.arc(
    x + myw * 2,
    y + myh + myw * 2,
    myw * 2,
    Math.PI * 1,
    Math.PI * 2,
    false
  );
  path.lineTo(x + myw * 4, y + myh * 5);
  path.lineTo(x, y + myh * 5);
  path.lineTo(x, y + myh + myw * 2);
  path.moveTo(x + myw, y + myh * 5);
  path.lineTo(x + myw, y + myh * 6);
  path.moveTo(x + myw * 2, y + myh * 5);
  path.lineTo(x + myw * 2, y + myh * 6);
  path.moveTo(x + myw * 3, y + myh * 5);
  path.lineTo(x + myw * 3, y + myh * 6);
  path.closePath();

  return path;
}

export function andGateAnchors(pen: any) {
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
    x: 0.25,
    y: 1,
  });

  anchors.push({
    id: '2',
    penId: pen.id,
    x: 0.5,
    y: 1,
  });

  anchors.push({
    id: '3',
    penId: pen.id,
    x: 0.75,
    y: 1,
  });
  pen.anchors = anchors;
}
