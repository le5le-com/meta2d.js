import { TopologyPen } from '../pen';

export function transferSymbol(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();
 
  let myh = pen.calculative.worldRect.height / 4;
  let myw = pen.calculative.worldRect.width / 2;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;

  //ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise)是后来添加的，

  // 参数的意思：(起点x.起点y,半径x,半径y,旋转的角度，起始角，结果角，顺时针还是逆时针)
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.lineTo(x + myw * 2, y + myh * 4);
  path.lineTo(x, y + myh * 4);
  path.lineTo(x + myw, y + myh);

  path.closePath();

  return path;
}