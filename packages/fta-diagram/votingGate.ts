import { TopologyPen } from '../core/src/pen';
export function votingGate(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  let myw = pen.calculative.worldRect.width / 2;
  let myh = pen.calculative.worldRect.height / 10;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.moveTo(x + myw, y + myh);
  path.quadraticCurveTo(x + myw * 2, y + myh, x + myw * 2, y + myh * 9);
  path.moveTo(x + myw, y + myh);
  path.quadraticCurveTo(x, y + myh, x, y + myh * 9);
  path.quadraticCurveTo(x + myw, y + myh * 6, x + myw * 2, y + myh * 9);
  path.moveTo(x + myw, y + (pen.calculative.worldRect.height * 3) / 4);
  path.lineTo(x + myw, y + (pen.calculative.worldRect.height * 9) / 10);
  path.moveTo(
    x + (myw * 2) / 5,
    y + (pen.calculative.worldRect.height * 201) / 250
  );
  path.lineTo(
    x + (myw * 2) / 5,
    y + (pen.calculative.worldRect.height * 9) / 10
  );
  path.moveTo(
    x + (myw * 8) / 5,
    y + (pen.calculative.worldRect.height * 201) / 250
  );
  path.lineTo(
    x + (myw * 8) / 5,
    y + (pen.calculative.worldRect.height * 9) / 10
  );
  return path;
}

export function votingGateChartByCtx(
  ctx: CanvasRenderingContext2D,
  pen: TopologyPen
) {
  ctx.beginPath();
  let myw = pen.calculative.worldRect.width / 2;
  let myh = pen.calculative.worldRect.height / 10;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;

  ctx.fillStyle = '#333333';
  ctx.font = myh + 'px Arial';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  ctx.fillText('o', x + myw, y + pen.calculative.worldRect.height);

  ctx.font = myh + 'px Arial';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  ctx.fillText('m', x + (myw * 2) / 5, y + pen.calculative.worldRect.height);

  ctx.font = myh + 'px Arial';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  ctx.fillText('o', x + (myw * 8) / 5, y + pen.calculative.worldRect.height);
  ctx.closePath();
  ctx.restore();
}
