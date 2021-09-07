import { Pen } from '../core/src/pen';

export function escalator(pen: any) {
  const path = new Path2D();

  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;

  let myw = pen.calculative.worldRect.width / 174;
  let myh = pen.calculative.worldRect.height / 204;

  //防盗板
  path.moveTo(x + myw * 5, y + myh * 43);
  path.lineTo(x + myw * 38, y + myh * 25);
  path.lineTo(x + myw * 56, y + myh * 30);
  path.lineTo(x + myw * 23, y + myh * 48);
  path.lineTo(x + myw * 5, y + myh * 43);

  // 楼梯
  path.moveTo(x + myw * 23, y + myh * 48);
  path.lineTo(x + myw * 103, y + myh * 193);
  path.lineTo(x + myw * 136, y + myh * 175);
  path.lineTo(x + myw * 56, y + myh * 30);
  path.lineTo(x + myw * 23, y + myh * 48);

  for (let i = 1; i < 24; i++) {
    path.moveTo(x + myw * 23 + 3.33 * i * myw, y + myh * 48 + 6 * i * myh);
    path.lineTo(x + myw * 56 + 3.33 * i * myw, y + myh * 30 + 6 * i * myh);
  }

  path.moveTo(x + myw * 103, y + myh * 193);
  path.lineTo(x + myw * 129, y + pen.calculative.worldRect.height);
  path.lineTo(x + myw * 162, y + myh * 186);
  path.lineTo(x + myw * 136, y + myh * 175);
  path.lineTo(x + myw * 103, y + myh * 193);

  for (let i = 1; i < 3; i++) {
    path.moveTo(x + myw * 103 + 8.67 * i * myw, y + myh * 193 + 3.67 * i * myh);
    path.lineTo(x + myw * 136 + 8.67 * i * myw, y + myh * 175 + 3.67 * i * myh);
  }

  //    let gradient=path.createLinearGradient(x +myw*23, y + myh*23,x +myw*103, y + myh*193);
  //    gradient.addColorStop(0,'#808080');
  //    gradient.addColorStop(0.5,'#ffffff');
  //    gradient.addColorStop(1,'#808080');

  let Offset = myw * 2;

  //左边扶手
  armrest(pen, x, y, myw, myh);
  x = x + myw * 33;
  y = y - myh * 18;
  //右边扶手
  armrest(pen, x, y, myw, myh);

  let offsetx = myw * 100;
  let offsety = myh * 100;
  myw = myw * 4;
  myh = myh * 4;

  let status = pen.data.status;
  if (status == 'up') {
    path.moveTo(x + offsetx + myw * 2, y + offsety);
    path.lineTo(x + offsetx + myw * 2, y + offsety - 4 * myh);
    path.lineTo(x + offsetx, y + offsety - 3 * myh);
    path.lineTo(x + offsetx + myw * 2.5, y + offsety - 8 * myh);
    path.lineTo(x + offsetx + myw * 5, y + offsety - 3 * myh);
    path.lineTo(x + offsetx + myw * 3, y + offsety - 4 * myh);
    path.lineTo(x + offsetx + myw * 3, y + offsety);
    path.lineTo(x + offsetx + myw * 2, y + offsety);
  } else if (status == 'down') {
    path.moveTo(x + offsetx + myw * 2, y + offsety);
    path.lineTo(x + offsetx + myw * 2, y + offsety + 4 * myh);
    path.lineTo(x + offsetx, y + offsety + 3 * myh);
    path.lineTo(x + offsetx + myw * 2.5, y + offsety + 8 * myh);
    path.lineTo(x + offsetx + myw * 5, y + offsety + 3 * myh);
    path.lineTo(x + offsetx + myw * 3, y + offsety + 4 * myh);
    path.lineTo(x + offsetx + myw * 3, y + offsety);
    path.lineTo(x + offsetx + myw * 2, y + offsety);
  }

  function armrest(pen: Pen, x: any, y: any, myw: any, myh: any) {
    let Offset = myw * 2;
    //左边扶手
    path.moveTo(x + myw * 23, y + myh * 48);
    path.lineTo(x + myw * 103, y + myh * 193);
    path.lineTo(x + myw * 103, y + myh * 168);
    path.lineTo(x + myw * 23, y + myh * 23);
    path.lineTo(x + myw * 23, y + myh * 48);

    path.moveTo(x + myw * 23, y + myh * 48);
    path.lineTo(x + myw * 5, y + myh * 43);
    path.lineTo(x + myw * 5, y + myh * 18);
    path.lineTo(x + myw * 23, y + myh * 23);

    path.moveTo(x + myw * 103, y + myh * 193);
    path.lineTo(x + myw * 129, y + pen.calculative.worldRect.height);
    path.lineTo(x + myw * 129, y + myh * 179);
    path.lineTo(x + myw * 103, y + myh * 168);
    path.lineTo(x + myw * 103, y + myh * 193);

    path.moveTo(x + myw * 129, y + pen.calculative.worldRect.height);
    path.quadraticCurveTo(x + myw * 134 + Offset, y + myh * 191.5, x + myw * 129, y + myh * 179);

    path.moveTo(x + myw * 5, y + myh * 43);
    path.quadraticCurveTo(x - Offset, y + myh * 30.5, x + myw * 5, y + myh * 18);

    //手扶条
    path.moveTo(x + myw * 103, y + myh * 168);
    path.lineTo(x + myw * 23, y + myh * 23);
    path.lineTo(x + myw * 28, y + myh * 18);
    path.lineTo(x + myw * 108, y + myh * 163);
    path.lineTo(x + myw * 103, y + myh * 168);

    path.moveTo(x + myw * 5, y + myh * 18);
    path.lineTo(x + myw * 23, y + myh * 23);
    path.lineTo(x + myw * 28, y + myh * 18);
    path.lineTo(x + myw * 10, y + myh * 13);
    path.lineTo(x + myw * 5, y + myh * 18);

    path.moveTo(x + myw * 129, y + myh * 179);
    path.lineTo(x + myw * 103, y + myh * 168);
    path.lineTo(x + myw * 108, y + myh * 163);
    path.lineTo(x + myw * 134, y + myh * 174);
    path.lineTo(x + myw * 129, y + myh * 179);

    path.moveTo(x + myw * 129, y + myh * 179);
    path.quadraticCurveTo(x + myw * 134 + Offset, y + myh * 191.5, x + myw * 129, y + pen.calculative.worldRect.height);
    path.lineTo(x + myw * 134, y + pen.calculative.worldRect.height - myh * 5);
    path.quadraticCurveTo(x + myw * 139 + Offset, y + myh * 186.5, x + myw * 134, y + myh * 174);
    path.lineTo(x + myw * 129, y + myh * 179);
  }

  path.closePath();
  return path;
}
