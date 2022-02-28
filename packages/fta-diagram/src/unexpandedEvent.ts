export function unexpandedEvent(
  pen: any,
  path?: CanvasRenderingContext2D | Path2D
) {
  if (!path) {
    path = new Path2D();
  }

  let myh = pen.calculative.worldRect.height / 3;
  let myw = 0.5 * pen.calculative.worldRect.width;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.lineTo(x + pen.calculative.worldRect.width, y + 2 * myh);
  path.lineTo(x + myw, y + pen.calculative.worldRect.height);
  path.lineTo(x, y + 2 * myh);
  path.lineTo(x + myw, y + myh);

  path.closePath();

  return path;
}

export function unexpandedEventAnchors(pen: any) {
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
    y: 2 / 3,
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
    x: 0,
    y: 2 / 3,
  });
  pen.anchors = anchors;
}
