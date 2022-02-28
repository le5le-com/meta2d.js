export function basicEvent(pen: any, path?: CanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }

  let vlineL =
    pen.calculative.worldRect.height - pen.calculative.worldRect.width;
  let radius = 0.5 * pen.calculative.worldRect.width;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + pen.calculative.worldRect.width / 2, y);
  path.lineTo(x + pen.calculative.worldRect.width / 2, y + vlineL);
  path.moveTo(x + pen.calculative.worldRect.width, y + radius + vlineL);
  path.arc(
    x + pen.calculative.worldRect.width / 2,
    y + radius + vlineL,
    radius,
    0,
    Math.PI * 2,
    false
  );

  path.closePath();

  return path;
}

export function basicEventAnchors(pen: any) {
  const anchors: any[] = [];
  anchors.push({
    id: '0',
    penId: pen.id,
    x: 0.5,
    y: 0,
  });

  anchors.push({
    id: '2',
    penId: pen.id,
    x: 0.5,
    y: 1,
  });

  pen.anchors = anchors;
}
