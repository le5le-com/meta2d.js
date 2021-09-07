import { Pen } from '../core/src/pen';
// const path = new Path2D();

export function coolingtowerfan(pen: Pen) {
  const path = new Path2D();

  let myw = pen.calculative.worldRect.width / 5;
  let myh = pen.calculative.worldRect.height / 5;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let value = 0;
  for (let i = 0; i < 4; i++) {
    fanblade(path, pen, value + (Math.PI / 2) * i, myw, myh, x, y);
  }
  fanheart(path, pen);

  path.closePath();
  return path;
}
//扇叶
function fanblade(path: Path2D, pen: Pen, rote: any, myw: any, myh: any, x: any, y: any) {
  let rx0 = x + myw * 2 + myw / 2; //旋转点
  let ry0 = y + myh * 2 + myh / 2;

  let endx = rx0; //结束点
  let endy = myw > myh ? ry0 - (myh * 2 + myh / 2) : ry0 - (myw * 2 + myw / 2);

  let rcontrolx = myw > myh ? rx0 + (myh * 3) / 2 : rx0 + (myw * 3) / 2; //左边控制点
  let rcontroly = myw > myh ? ry0 - myh * 2.3 : ry0 - myw * 2.3;

  let lcontrolx = myw > myh ? rx0 - (myh * 3) / 2 : rx0 - (myw * 3) / 2; //右边控制点
  let lcontroly = myw > myh ? ry0 - myh * 2.3 : ry0 - myw * 2.3;

  let afterendx = (endx - rx0) * Math.cos(rote) - (endy - ry0) * Math.sin(rote) + rx0; //旋转后
  let afterendy = (endx - rx0) * Math.sin(rote) + (endy - ry0) * Math.cos(rote) + ry0;

  let afterrcontrolx = (rcontrolx - rx0) * Math.cos(rote) - (rcontroly - ry0) * Math.sin(rote) + rx0;
  let afterrcontroly = (rcontrolx - rx0) * Math.sin(rote) + (rcontroly - ry0) * Math.cos(rote) + ry0;
  let afterlcontrolx = (lcontrolx - rx0) * Math.cos(rote) - (lcontroly - ry0) * Math.sin(rote) + rx0;
  let afterlcontroly = (lcontrolx - rx0) * Math.sin(rote) + (lcontroly - ry0) * Math.cos(rote) + ry0;

  path.moveTo(rx0, ry0);
  path.quadraticCurveTo(afterrcontrolx, afterrcontroly, afterendx, afterendy);
  path.moveTo(rx0, ry0);
  path.quadraticCurveTo(afterlcontrolx, afterlcontroly, afterendx, afterendy);
}

//扇心
function fanheart(path: Path2D, pen: Pen) {
  let hx = pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2;
  let hy = pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2;
  let r =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? pen.calculative.worldRect.height / 12
      : pen.calculative.worldRect.width / 12;
  path.moveTo(hx + r, hy);
  path.arc(hx, hy, r, 0, Math.PI * 2, false);
}
