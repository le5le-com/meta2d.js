export function votingGate(ctx: CanvasRenderingContext2D, pen: any) {
  let myw = pen.calculative.worldRect.width / 2;
  let myh = pen.calculative.worldRect.height / 10;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;

  ctx.beginPath();
  ctx.moveTo(x + myw, y);
  ctx.lineTo(x + myw, y + myh);
  ctx.moveTo(x + myw, y + myh);
  ctx.quadraticCurveTo(x + myw * 2, y + myh, x + myw * 2, y + myh * 9);
  ctx.moveTo(x + myw, y + myh);
  ctx.quadraticCurveTo(x, y + myh, x, y + myh * 9);
  ctx.quadraticCurveTo(x + myw, y + myh * 6, x + myw * 2, y + myh * 9);
  ctx.moveTo(x + myw, y + (pen.calculative.worldRect.height * 3) / 4);
  ctx.lineTo(x + myw, y + (pen.calculative.worldRect.height * 9) / 10);
  ctx.moveTo(
    x + (myw * 2) / 5,
    y + (pen.calculative.worldRect.height * 201) / 250
  );
  ctx.lineTo(
    x + (myw * 2) / 5,
    y + (pen.calculative.worldRect.height * 9) / 10
  );
  ctx.moveTo(
    x + (myw * 8) / 5,
    y + (pen.calculative.worldRect.height * 201) / 250
  );
  ctx.lineTo(
    x + (myw * 8) / 5,
    y + (pen.calculative.worldRect.height * 9) / 10
  );
  ctx.stroke();
  ctx.closePath();

  ctx.beginPath();
  let fontSize = myw * 2 > myh * 10 ? myh : myw / 5;
  ctx.fillStyle = '#333333';
  ctx.font = fontSize + 'px Arial';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  ctx.fillText('o', x + myw, y + pen.calculative.worldRect.height);
  ctx.fillText('m', x + (myw * 2) / 5, y + pen.calculative.worldRect.height);
  ctx.fillText('o', x + (myw * 8) / 5, y + pen.calculative.worldRect.height);
  ctx.closePath();

  return false;
}
