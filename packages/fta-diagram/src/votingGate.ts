import { Pen } from '../../core';

export function votingGate(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen.calculative.worldRect;
  const myw = width / 2;
  const myh = height / 10;

  ctx.beginPath();
  ctx.moveTo(x + myw, y);
  ctx.lineTo(x + myw, y + myh);
  ctx.moveTo(x + myw, y + myh);
  ctx.quadraticCurveTo(x + myw * 2, y + myh, x + myw * 2, y + myh * 9);
  ctx.moveTo(x + myw, y + myh);
  ctx.quadraticCurveTo(x, y + myh, x, y + myh * 9);
  ctx.quadraticCurveTo(x + myw, y + myh * 6, x + myw * 2, y + myh * 9);
  ctx.moveTo(x + myw, y + (height * 3) / 4);
  ctx.lineTo(x + myw, y + (height * 9) / 10);
  ctx.moveTo(x + (myw * 2) / 5, y + (height * 201) / 250);
  ctx.lineTo(x + (myw * 2) / 5, y + (height * 9) / 10);
  ctx.moveTo(x + (myw * 8) / 5, y + (height * 201) / 250);
  ctx.lineTo(x + (myw * 8) / 5, y + (height * 9) / 10);
  ctx.stroke();
  ctx.closePath();

  ctx.beginPath();
  const fontSize = myw * 2 > myh * 10 ? myh : myw / 5;
  ctx.fillStyle = '#333333';
  ctx.font = fontSize + 'px Arial';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  ctx.fillText('o', x + myw, y + height);
  ctx.fillText('m', x + (myw * 2) / 5, y + height);
  ctx.fillText('o', x + (myw * 8) / 5, y + height);
  ctx.closePath();
}
