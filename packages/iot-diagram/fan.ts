import { TopologyPen } from '../core/src/pen';

export function fan(pen: any) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();
  let myw = pen.calculative.worldRect.width / 5;
  let myh = pen.calculative.worldRect.height / 5;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;

  //扇底色

  let r =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? pen.calculative.worldRect.height / 2 - myh / 4
      : pen.calculative.worldRect.width / 2 - myw / 4;
  path.arc(
    x + myw * 2 + myw / 2,
    y + myh * 2 + myh / 2,
    r,
    0,
    Math.PI * 2,
    false
  );
  let value = pen.data.rotate;

  for (let i = 0; i < 6; i++) {
    fanblade(path,pen, value + (Math.PI / 3) * i, myw, myh, x, y);
  }
  fanheart(path,pen, myw, myh, x, y);
  fanring(path,pen, myw, myh, x, y);

  path.closePath();
  return path;
}

//扇叶
function fanblade(
  path:Path2D,
  pen: TopologyPen,
  rote: any,
  myw: any,
  myh: any,
  x: any,
  y: any
) {
  let rx0 = x + myw * 2 + myw / 2; //旋转点
  let ry0 = y + myh * 2 + myh / 2;

  let endx = rx0; //pen.calculative.worldRect.width> pen.calculative.worldRect.height?ry0:rx0; //结束点
  let endy =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? ry0 - (myh * 2 + myh / 2)
      : ry0 - (myw * 2 + myw / 2);

  let controlx =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? rx0 + (myh * 7) / 4
      : rx0 + (myw * 7) / 4; //外层控制点
  let controly =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? ry0 - (myh * 2 + myh / 2) / 2
      : ry0 - (myw * 2 + myw / 2) / 2;

  let controlxInternal =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? rx0 + myh / 2
      : rx0 + myw / 2; //内层控制点
  let controlyInternal =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? ry0 - (myh * 2 + myh / 2) / 2
      : ry0 - (myw * 2 + myw / 2) / 2;

  let afterendx =
    (endx - rx0) * Math.cos(rote) - (endy - ry0) * Math.sin(rote) + rx0; //旋转后
  let afterendy =
    (endx - rx0) * Math.sin(rote) + (endy - ry0) * Math.cos(rote) + ry0;

  let aftercontrolx =
    (controlx - rx0) * Math.cos(rote) - (controly - ry0) * Math.sin(rote) + rx0;
  let aftercontroly =
    (controlx - rx0) * Math.sin(rote) + (controly - ry0) * Math.cos(rote) + ry0;
  let aftercontrolxInternal =
    (controlxInternal - rx0) * Math.cos(rote) -
    (controlyInternal - ry0) * Math.sin(rote) +
    rx0;
  let aftercontrolyInternal =
    (controlxInternal - rx0) * Math.sin(rote) +
    (controlyInternal - ry0) * Math.cos(rote) +
    ry0;

  path.moveTo(rx0, ry0);
  path.quadraticCurveTo(aftercontrolx, aftercontroly, afterendx, afterendy); //控制点 结束点

  path.moveTo(rx0, ry0);
  path.quadraticCurveTo(
    aftercontrolxInternal,
    aftercontrolyInternal,
    afterendx,
    afterendy
  ); //控制点 结束点
}

//扇心
function fanheart( path:Path2D,pen: TopologyPen, myw: any, myh: any, x: any, y: any) {
  let r1 =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? myh / 2
      : myw / 2;
  let r2 =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? myh / 8
      : myw / 8;
  path.moveTo(x + myw * 2 + myw / 2, y + myh * 2 + myh / 2);
  path.arc(
    x + myw * 2 + myw / 2,
    y + myh * 2 + myh / 2,
    r1,
    0,
    Math.PI * 2,
    false
  );
  path.moveTo(x + myw * 2 + myw / 2, y + myh * 2 + myh / 2);
  path.arc(
    x + myw * 2 + myw / 2,
    y + myh * 2 + myh / 2,
    r2,
    0,
    Math.PI * 2,
    false
  );
}

//扇环
function fanring( path:Path2D,pen: TopologyPen, myw: any, myh: any, x: any, y: any) {
  let r1 =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? pen.calculative.worldRect.height / 2 - myh / 4
      : pen.calculative.worldRect.width / 2 - myw / 4;
  let r2 =
    pen.calculative.worldRect.width > pen.calculative.worldRect.height
      ? myh * 2 + myh / 2
      : myw * 2 + myw / 2;
  path.moveTo(x + myw * 2 + myw / 2+r1, y + myh * 2 + myh / 2);
  path.arc(
    x + myw * 2 + myw / 2,
    y + myh * 2 + myh / 2,
    r1,
    0,
    Math.PI * 2,
    false
  );
  path.moveTo(x + myw * 2 + myw / 2+r2, y + myh * 2 + myh / 2);
  path.arc(
    x + myw * 2 + myw / 2,
    y + myh * 2 + myh / 2,
    r2,
    0,
    Math.PI * 2,
    true
  );
}
