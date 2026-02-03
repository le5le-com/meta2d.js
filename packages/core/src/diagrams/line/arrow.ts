import { Pen, LineAnimateType } from '../../pen';
import { Point } from '../../point';
import { deepClone } from '../../utils';
import { getBezierPoint, getQuadraticPoint } from './curve';

//箭头动画
export function drawArrow(
  pen: Pen,
  ctx?: CanvasRenderingContext2D | Path2D
): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  let worldAnchors = pen.calculative.worldAnchors;
  let scale = pen.calculative.canvas.store.data.scale;
  let size = (pen.calculative.animateLineWidth || 6) * scale; // 箭头大小
  let arrowLength = (pen.animateLineWidth*2 || 12) * scale; // 箭头长度
  if(pen.lineAnimateType === LineAnimateType.WaterDrop){
    arrowLength = (pen.animateLineWidth*4 || 24) * scale; // 水滴长度
  }
  let d = (pen.animateInterval || 100) * scale; // 箭头间距
  let smoothLenth = pen.calculative.lineWidth *(pen.calculative.lineSmooth || 0)//*scale;
  let lineWidth = (pen.calculative.animateLineWidth/2 || 3) * scale;
  if (pen.animateReverse) {
    //箭头反向
    arrowLength = -arrowLength;
    size = -size;
  }
  if (worldAnchors.length > 1) {
    let from: Point; // 上一个点
    let lastLength = 0;
    if(pen.close){
      worldAnchors = deepClone(worldAnchors);
      worldAnchors.push(worldAnchors[0]);
    }
    if(['polyline','line'].includes(pen.lineName)){
      for (let i = 0; i < worldAnchors.length; i++) {
        let pt = worldAnchors[i];
        //获取箭头角度
        if (from) {
          let angle = getAngle(from, pt);
          let newP = {
            x:
              from.x +
              ((pen.calculative.animatePos - lastLength) % d) *
                Math.cos((angle * Math.PI) / 180),
            y:
              from.y -
              ((pen.calculative.animatePos - lastLength) % d) *
                Math.sin((angle * Math.PI) / 180),
          };
          if (pen.animateReverse) {
            newP = {
              x:
                from.x +
                ((pen.length - (pen.calculative.animatePos + lastLength)) % d) *
                  Math.cos((angle * Math.PI) / 180),
              y:
                from.y -
                ((pen.length - (pen.calculative.animatePos + lastLength)) % d) *
                  Math.sin((angle * Math.PI) / 180),
            };
          }
          let newPTFrom = Math.sqrt(
            (newP.x - from.x) ** 2 + (newP.y - from.y) ** 2
          );
          let ptTFrom = Math.sqrt((pt.x - from.x) ** 2 + (pt.y - from.y) ** 2);
          while (newPTFrom < ptTFrom) {
            if (
              ((pen.animateReverse && newPTFrom - arrowLength < ptTFrom) || //不允许超出连线绘制
              (!pen.animateReverse &&
                newPTFrom > arrowLength)) &&
                newPTFrom > (smoothLenth+arrowLength) &&
                ptTFrom - newPTFrom > smoothLenth
            ) {
              if(pen.lineAnimateType === LineAnimateType.Arrow){
                arrow(path, newP, size, angle, lineWidth, arrowLength);
              }else if(pen.lineAnimateType === LineAnimateType.WaterDrop){
                waterDrop(path, newP, pen.animateReverse, angle, lineWidth, arrowLength);
              }
            }
            newP.x += d * Math.cos((angle * Math.PI) / 180);
            newP.y -= d * Math.sin((angle * Math.PI) / 180);
            newPTFrom = Math.sqrt(
              (newP.x - from.x) ** 2 + (newP.y - from.y) ** 2
            );
          }
        }
        from = pt;
      }
    }else{
      let from: Point; // 上一个点
      let pos = (pen.calculative.animatePos % d) / d;
      if(pos>1){
        pos = 1
      }
      if(pen.animateReverse){
        pos = 1-pos;
      }
      worldAnchors.forEach((pt: Point) => {
        let to = pt;
        if (from) {
          let step = 1 / (from.lineLength / d);
          pos = pos % step;
          if (from.next) {
            if (to.prev) {
              for (let i = pos; i < 1; i += step) {
                let point = getBezierPoint(i, from, from.next, to.prev, to);
                let pointNext = getBezierPoint(
                  i + 0.001,
                  from,
                  from.next,
                  to.prev,
                  to,
                );
                let angle = getAngle(point, pointNext);
                if (pen.lineAnimateType === LineAnimateType.Arrow) {
                  arrow(path, point, size, angle, lineWidth, arrowLength);
                } else if (
                  pen.lineAnimateType === LineAnimateType.WaterDrop
                ) {
                  waterDrop(
                    path,
                    point,
                    pen.animateReverse,
                    angle,
                    lineWidth,
                    arrowLength,
                  );
                }
              }
            } else {
              for (let i = pos; i < 1; i += step) {
                let point = getQuadraticPoint(i, from, from.next, to);
                let pointNext = getQuadraticPoint(
                  i + 0.001,
                  from,
                  from.next,
                  to,
                );
                let angle = getAngle(point, pointNext);
                if (pen.lineAnimateType === LineAnimateType.Arrow) {
                  arrow(path, point, size, angle, lineWidth, arrowLength);
                } else if (
                  pen.lineAnimateType === LineAnimateType.WaterDrop
                ) {
                  waterDrop(
                    path,
                    point,
                    pen.animateReverse,
                    angle,
                    lineWidth,
                    arrowLength,
                  );
                }
              }
            }
          } else {
            if (to.prev) {
              for (let i = pos; i < 1; i += step) {
                let point = getQuadraticPoint(i, from, to.prev, to);
                let pointNext = getQuadraticPoint(
                  i + 0.001,
                  from,
                  to.prev,
                  to,
                );
                let angle = getAngle(point, pointNext);
                if (pen.lineAnimateType === LineAnimateType.Arrow) {
                  arrow(path, point, size, angle, lineWidth, arrowLength);
                } else if (
                  pen.lineAnimateType === LineAnimateType.WaterDrop
                ) {
                  waterDrop(
                    path,
                    point,
                    pen.animateReverse,
                    angle,
                    lineWidth,
                    arrowLength,
                  );
                }
              }
            } else {
              let angle = getAngle(from, to);
              for (let i = pos; i < 1; i += step) {
                let point = {
                  x: from.x + (to.x - from.x) * i,
                  y: from.y + (to.y - from.y) * i,
                };
                if (pen.lineAnimateType === LineAnimateType.Arrow) {
                  arrow(path, point, size, angle, lineWidth, arrowLength);
                } else if (
                  pen.lineAnimateType === LineAnimateType.WaterDrop
                ) {
                  waterDrop(
                    path,
                    point,
                    pen.animateReverse,
                    angle,
                    lineWidth,
                    arrowLength,
                  );
                }
              }
            }
          }
        }
        from = pt;
      });
    }
  }
  if (path instanceof Path2D) return path;
}

//获取两点连线和水平线的夹角
function getAngle(p1, p2) {
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  let angle = (Math.atan(dy / dx) * 180) / Math.PI;
  if (p2.x >= p1.x) {
    angle = -angle;
  } else {
    angle = 180 - angle;
  }
  return angle;
}

//获取p相对rp旋转_angle后的点坐标
function getRotatePoint(p: Point, rp: Point, _angle: number) {
  let angle = ((180 - _angle) * Math.PI) / 180;
  return {
    x: (p.x - rp.x) * Math.cos(angle) - (p.y - rp.y) * Math.sin(angle) + rp.x,
    y: (p.x - rp.x) * Math.sin(angle) + (p.y - rp.y) * Math.cos(angle) + rp.y,
  };
}

//标准箭头
function arrow(path:CanvasRenderingContext2D |Path2D, newP:Point, size:number, angle:number, lineWidth:number, arrowLength:number){
  let pr = getRotatePoint(
    { x: newP.x + size, y: newP.y + 0.57*size },
    { x: newP.x, y: newP.y },
    angle
  );
  let pl = getRotatePoint(
    { x: newP.x + size, y: newP.y - 0.57*size },
    { x: newP.x, y: newP.y },
    angle
  );
  let pr1 = getRotatePoint(
    { x: newP.x + size, y: newP.y + lineWidth/2 },
    { x: newP.x, y: newP.y },
    angle
  );
  let pr2 = getRotatePoint(
    { x: newP.x + arrowLength, y: newP.y + lineWidth/2},
    { x: newP.x, y: newP.y },
    angle
  );
  let pl1 = getRotatePoint(
    { x: newP.x + size, y: newP.y - lineWidth/2 },
    { x: newP.x, y: newP.y },
    angle
  );
  let pl2 = getRotatePoint(
    { x: newP.x + arrowLength, y: newP.y - lineWidth/2 },
    { x: newP.x, y: newP.y },
    angle
  );
  path.moveTo(pr.x, pr.y);
  path.lineTo(newP.x, newP.y);
  path.lineTo(pl.x, pl.y);
  path.lineTo(pl1.x, pl1.y);
  path.lineTo(pl2.x, pl2.y);
  path.lineTo(pr2.x, pr2.y);
  path.lineTo(pr1.x, pr1.y);
  path.lineTo(pr.x, pr.y);
}

//水滴
function waterDrop(path:CanvasRenderingContext2D |Path2D, newP:Point, reverse:boolean, angle:number, lineWidth:number, arrowLength:number){
  let dis = lineWidth/2;
  if(reverse){
    dis = -lineWidth/2;
  }
  let pl1 = getRotatePoint(
    { x: newP.x, y: newP.y + dis },
    { x: newP.x, y: newP.y },
    angle
  );
  let pE = getRotatePoint(
    { x: newP.x + arrowLength, y: newP.y  },
    { x: newP.x, y: newP.y },
    angle
  );
  let rAngle =Math.PI/2;
  if(reverse){
    rAngle = -Math.PI/2;
  }
  path.moveTo(newP.x, newP.y);
  path.arc(newP.x, newP.y, lineWidth/2, -rAngle-angle/180*Math.PI, rAngle-angle/180*Math.PI, false);
  path.lineTo(pE.x, pE.y);
  path.lineTo(pl1.x, pl1.y);
}
