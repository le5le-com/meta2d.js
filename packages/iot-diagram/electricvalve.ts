import { Pen } from '../core/src/pen';
export function electricvalve(pen: Pen) {
  const path = new Path2D();

  let myw = pen.calculative.worldRect.width / 75;
  let myh = pen.calculative.worldRect.height / 72;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let halfWidth = pen.calculative.worldRect.width / 2;

  path.moveTo(x + halfWidth, y + myh * 8);
  path.lineTo(x + halfWidth, y);
  path.lineTo(x, y);
  path.lineTo(x, y + 70 * myh);
  path.lineTo(x + halfWidth - 12 * myw, y + 70 * myh);
  path.lineTo(x + halfWidth - 12 * myw, y + 68 * myh);
  path.lineTo(x + halfWidth - 35 * myw, y + 68 * myh);
  path.lineTo(x + halfWidth - 35 * myw, y + myh * 2);
  path.lineTo(x + halfWidth - 2 * myw, y + myh * 2);
  path.lineTo(x + halfWidth - 2 * myw, y + myh * 8);
  path.lineTo(x + halfWidth, y + myh * 8);

  path.moveTo(x + halfWidth - 8 * myw, y + myh * 29);
  path.rect(x + halfWidth - 8 * myw, y + myh * 29, myw * 16, myh * 24);

  path.moveTo(x + halfWidth - 27 * myw, y + myh * 11);
  path.lineTo(x + halfWidth - 15 * myw, y + myh * 8);
  path.lineTo(x + halfWidth + 15 * myw, y + myh * 8);
  path.lineTo(x + halfWidth + 27 * myw, y + myh * 11);
  path.lineTo(x + halfWidth + 27 * myw, y + myh * 26);
  path.lineTo(x + halfWidth + 15 * myw, y + myh * 29);
  path.lineTo(x + halfWidth - 15 * myw, y + myh * 29);
  path.lineTo(x + halfWidth - 27 * myw, y + myh * 26);
  path.lineTo(x + halfWidth - 27 * myw, y + myh * 11);

  path.moveTo(x + halfWidth - 12 * myw, y + myh * 53);
  path.rect(x + halfWidth - 12 * myw, y + myh * 53, myw * 24, myh * 19);

  path.moveTo(x + halfWidth - 31 * myw, y + myh * 16.5);
  path.rect(x + halfWidth - 31 * myw, y + myh * 16.5, myw * 62, myh * 4);

  path.moveTo(x + halfWidth - 31 * myw, y + myh * 18.5);
  path.lineTo(x + halfWidth + 31 * myw, y + myh * 18.5);

  path.moveTo(x + halfWidth - 10 * myw, y + myh * 29);
  path.rect(x + halfWidth - 10 * myw, y + myh * 29, myw * 20, myh * 2);

  let r = myw > myh ? myh : myw;
  path.moveTo(x + halfWidth + 6.5 * r, y + myh * 53);
  path.arc(x + halfWidth, y + myh * 53, 6.5 * r, 0, Math.PI * 2, false);
  path.moveTo(x + halfWidth + 3.5 * r, y + myh * 53);
  path.arc(x + halfWidth, y + myh * 53, 3.5 * r, 0, Math.PI * 2, false);
  path.moveTo(x + halfWidth - 5 * myw + 4 * r, y + myh * 66);
  path.arc(x + halfWidth - 5 * myw, y + myh * 66, 4 * r, 0, Math.PI * 2, false);
  path.moveTo(x + halfWidth + 5 * myw + 4 * r, y + myh * 66);
  path.arc(x + halfWidth + 5 * myw, y + myh * 66, 4 * r, 0, Math.PI * 2, false);

  path.moveTo(x + halfWidth - 5 * myw, y + myh * 66);
  path.lineTo(x + halfWidth - 5 * myw - 4 * r, y + myh * 66);

  path.moveTo(x + halfWidth + 5 * myw, y + myh * 66);
  path.lineTo(x + halfWidth + 5 * myw + 4 * r, y + myh * 66);

  path.moveTo(x + halfWidth - 5 * myw, y + myh * 66);
  path.lineTo(x + halfWidth - 5 * myw + 1 * r, y + myh * 65);

  path.moveTo(x + halfWidth + 5 * myw, y + myh * 66);
  path.lineTo(x + halfWidth + 5 * myw, y + myh * 65);

  path.closePath();
  return path;
}
