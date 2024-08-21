/*
 * 直线连线交叉问题,在画布上，当2条或多条线交叉时，
 * 其中一条线会弯曲显示，表明这2条或多条线之间，不存在交叉。
 * author: Joseph Ho
 * email: hejin@le5le.com
 * date: 2022.09.09
*/
import { s8 } from '../../core';
enum PenType {
  Node,
  Line,
}
enum PrevNextType {
  Mirror,
  Bilateral,
  Free,
}
interface PurePoint {
  x: number;
  y: number;
}
// 相交点的半径
let radius = 1;
// 判断点在线上的偏移值
const dotHitOffset = 2;
// 锚点坐标误差偏移值,用于去掉重复锚点
const anchorOffsetXY = 0.000001;
// 锚点数组
let anchors = [];
// mousedown到up的标志位,标识一整个鼠标down到up的动作
let downToUpFlag = false;
// 图纸渲染完成是否默认相交弯曲
let isDefaultCross = false;
const crossLines = ['line', 'polyline'];
export function lineCross(defaultCross: any) {
  (window as any).meta2d.on('mouseup', mouseUp);
  (window as any).meta2d.on('mousedown', mouseDown);
  (window as any).meta2d.on('add', add);
  (window as any).meta2d.on('active', active);
  isDefaultCross = defaultCross;
  (window as any).meta2d.on('opened', opened);
}
export function handleLineCross(flag: any) {
  mouseDown();
  mouseUp(flag);
}
function opened() {
  // 如果需要默认相交弯曲，则走以下逻辑
  if (isDefaultCross) {
    handleLineCross(undefined);
  }
}
function active() {
  downToUpFlag = true;
}
function add() {
  downToUpFlag = true;
}
function mouseDown() {
  downToUpFlag = true;
}
function clearIntersect(e) {
  let worldAnchors = [], ls = [];
  // 画布活动节点
  const pens = e ? (window as any).meta2d.store.active : (window as any).meta2d.store.data.pens;
  const actives = pens.filter(el => el);
  // 活动的连线，包括直线和线段
  // ls = actives.filter(pen => pen.type === PenType.Line && crossLines.indexOf(pen.lineName) !== -1);
  for (let i = 0; i < actives.length; i++) {
    const pen = actives[i];
    if (pen.type === PenType.Line && crossLines.indexOf(pen.lineName) !== -1) {
      // 添加直线和线段节点
      ls.push(pen);
    } else if (pen.connectedLines && pen.connectedLines.length > 0) {
      // 添加连接节点的连线
      for (let j = 0; j < pen.connectedLines.length; j++) {
        const item = pen.connectedLines[j];
        ls.push((window as any).meta2d.find(item.lineId)[0]);
      }
    }
    // 找出被压线的连线
    const ll = (window as any).meta2d.store.data.pens.filter(el => el.intersectLines
      && el.intersectLines.findIndex(item => item.id === pen.id) !== -1);
    ls.push(...ll);
  }
  ls = ls.filter(el => el);
  // mouseDown的事件回调中去删除intersect=true的锚点
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    l.intersectLines = [];
    if (ls[i] && ls[i].calculative) {
      worldAnchors = ls[i].calculative.worldAnchors;
      if (worldAnchors.length > 2) {
        for (let j = 0; j < worldAnchors.length; j++) {
          const an = worldAnchors[j];
          if (an.next || an.prev) {
            worldAnchors.splice(j, 1);
            j--;
          }
        }
        (window as any).meta2d.canvas.initLineRect(l);
      }
    }
  }
}
function mouseUp(e: any) {
  if (downToUpFlag) {
    downToUpFlag = false;
    setTimeout(() => {
      // 画布活动节点
      const pens = e ? (window as any).meta2d.store.active : (window as any).meta2d.store.data.pens;
      // 弯曲的情况与pen的顺序有关，所以需要倒序
      const actives = pens.filter(el => el).reverse();
      // 活动的连线，包括直线和线段
      let ls = [], passiveL = [];
      // const ls = actives.filter(pen => pen.type === PenType.Line && crossLines.indexOf(pen.lineName) !== -1);
      for (let i = 0; i < actives.length; i++) {
        const pen = actives[i];
        if (pen.type === PenType.Line && crossLines.indexOf(pen.lineName) !== -1) {
          // 添加直线和线段节点
          if (pen.connectedLines) {
            // 删除连线的错误connectedLines连接关系
            for (let v = 0; v < pen.connectedLines.length; v++) {
              const element = pen.connectedLines[v];
              let anchor = pen.anchors.find(anchor => anchor.id === element.anchor);
              if (anchor && anchor.penId) {
                let line = (window as any).meta2d.findOne(element.lineId);
                if (!line) {
                  continue;
                }
                if (line.connectedLines && line.connectedLines.length > 0) {
                  let otherIndex = line.connectedLines.findIndex((connect) => connect.anchor === element.lineAnchor);
                  line.connectedLines.splice(otherIndex, 1);
                }
                pen.connectedLines.splice(v, 1);
                v--;
              }
            }
          }

          ls.push(pen);
        } else if (pen.type !== PenType.Line && pen.connectedLines && pen.connectedLines.length > 0) {
          // 添加连接节点的连线
          for (let j = 0; j < pen.connectedLines.length; j++) {
            const item = pen.connectedLines[j];
            ls.push((window as any).meta2d.find(item.lineId)[0]);
          }
        }
        // 找出被压线的连线
        passiveL = (window as any).meta2d.store.data.pens.filter(el => el.intersectLines && el.intersectLines.findIndex(item => item.id === pen.id) !== -1);
        ls.unshift(...passiveL);
      }
      // 过滤出所有的连线，包括直线和线段，不包括acitve里面的连线
      const lines = (window as any).meta2d.store.data.pens.filter(pen => pen.type === PenType.Line
        && crossLines.indexOf(pen.lineName) !== -1);
      // 判断压线之前先清空相交情况
      clearIntersect(e);
      ls = ls.filter(el => el);
      for (let i = 0; i < ls.length; i++) {
        const initiativeAnchors = ls[i].calculative.worldAnchors.filter(el => !el.next && !el.prev);
        // 重置锚点数组
        anchors = [];
        for (let m = 0; m < initiativeAnchors.length; m++) {
          if (m !== initiativeAnchors.length - 1) {
            // 连接线的两个锚点
            const l1 = initiativeAnchors[m];
            const l11 = initiativeAnchors[m + 1];
            for (let j = 0; j < lines.length; j++) {
              // 重置半径
              radius = 3;
              // 根据线宽计算新的相交圆的半径
              radius += (lines[j].lineWidth / ls[i].lineWidth) * ls[i].lineWidth;
              // 乘以当前画布缩放比
              radius *= (window as any).meta2d.store.data.scale;
              const passiveAnchors = lines[j].calculative.worldAnchors.filter(el => !el.next && !el.prev);
              for (let n = 0; n < passiveAnchors.length; n++) {
                if (n !== passiveAnchors.length - 1) {
                  // 被相交线的两个锚点
                  const l2 = passiveAnchors[n];
                  const l22 = passiveAnchors[n + 1];
                  // 判断两条直线是否相交，当onLine1和onLine2都为true时，则相交
                  const { onLine1, onLine2, x, y } = checkLineIntersection(l1.x, l1.y, l11.x, l11.y, l2.x, l2.y, l22.x, l22.y);
                  // 如果两条线段相交
                  if (onLine1 && onLine2) {
                    // 去被连接线的相交线数组查找是否已经与连接线相交，是则跳过本次循环，否则继续
                    if (lines[j].intersectLines) {
                      const tIndex = lines[j].intersectLines.findIndex(el => el.id === ls[i].id
                        && el.fromAnchorIndex === n && el.toAnchorIndex === m);
                      if (tIndex !== -1) {
                        continue;
                      }
                    }
                    // 更新连接线的相交线数组
                    if (!ls[i].intersectLines) {
                      // 如果相交，则把被相交的线id放到连接线的intersectLines数组
                      ls[i].intersectLines = [];
                      ls[i].intersectLines.push({ fromAnchorIndex: m, toAnchorIndex: n, id: lines[j].id });
                    } else {
                      const index = ls[i].intersectLines.findIndex(el => el.id === lines[j].id && el.fromAnchorIndex === m && el.toAnchorIndex === n);
                      if (index === -1) {
                        ls[i].intersectLines.push({ fromAnchorIndex: m, toAnchorIndex: n, id: lines[j].id });
                      }
                    }
                    // 算出拖动线条的直线方程式
                    const { a, b, c } = lineFromPoints(l1, l11);
                    const k = - (a / b);
                    // 以相交点为圆心，找到圆与线相交的两个点，作为锚点
                    let p1: PurePoint = { x: 0, y: 0 }, p2: PurePoint = { x: 0, y: 0 };
                    const deltaX = Math.sqrt((radius * radius) / (k * k + 1));
                    p1.x = x - deltaX;
                    p1.y = k * p1.x;
                    p2.x = x + deltaX;
                    p2.y = k * p2.x;
                    // 求出经过圆心的直线与圆的两个交点
                    const ret = inteceptCircleLineSeg({ radius, x, y }, { p1: l1, p2: l11 });
                    // 只有圆与线有2个端点才弯曲显示
                    if (ret.length === 2) {
                      let k1 = 1;
                      if (a !== 0) {
                        // 垂直相交线的斜率
                        k1 = b / a;
                      } else {
                        // a=0,则为平行于x轴的线
                        k1 = y;
                      }

                      const deltaX1 = Math.sqrt((radius * radius) / (k1 * k1 + 1));
                      const deltaY1 = k1 * deltaX1;
                      // 锚点的两个控制点
                      let p4: PurePoint = { x: 0, y: 0 }, p5: PurePoint = { x: 0, y: 0 };
                      // 判断垂直相交线的斜率是否大于0
                      if (-k1 < 0) {
                        p4.x = ret[0].x - deltaX1;
                        p4.y = ret[0].y - deltaY1;
                        p5.x = ret[1].x - deltaX1;
                        p5.y = ret[1].y - deltaY1;
                      } else {
                        p4.x = ret[0].x + deltaX1;
                        p4.y = ret[0].y + deltaY1;
                        p5.x = ret[1].x + deltaX1;
                        p5.y = ret[1].y + deltaY1;
                      }
                      // 找到相交点所在正确的线段l3
                      let l3 = { x: 0, y: 0, id: '' };
                      for (let u = 0; u < initiativeAnchors.length; u++) {
                        if (u !== initiativeAnchors.length - 1) {
                          const u1 = initiativeAnchors[u];
                          const u11 = initiativeAnchors[u + 1];
                          const cross = calcIsInsideThickLineSegment(u1, u11, { x, y }, dotHitOffset);
                          if (cross) {
                            l3.x = u1.x;
                            l3.y = u1.y;
                            l3.id = u1.id;
                            break;
                          }
                        }
                      }
                      const an1 = {
                        id: s8(),
                        penId: ls[i].id,
                        x: ret[0].x,
                        y: ret[0].y,
                        intersect: true,
                        hidden: true,
                        locked: 2,
                        lastAnchorIndex: l3.id,
                        brotherId: "",
                        next: {
                          penId: ls[i].id,
                          x: p4.x,
                          y: p4.y,
                        },
                        prev: {
                          penId: ls[i].id,
                          x: ret[0].x,
                          y: ret[0].y,
                        },
                        prevNextType: PrevNextType.Bilateral
                      };
                      const an2 = {
                        id: s8(),
                        penId: ls[i].id,
                        x: ret[1].x,
                        y: ret[1].y,
                        intersect: true,
                        hidden: true,
                        locked: 2,
                        brotherId: "",
                        lastAnchorIndex: l3.id,
                        next: {
                          penId: ls[i].id,
                          x: ret[1].x,
                          y: ret[1].y,
                        },
                        prev: {
                          penId: ls[i].id,
                          x: p5.x,
                          y: p5.y,
                        },
                        prevNextType: PrevNextType.Bilateral
                      };
                      an1.brotherId = an2.id;
                      an2.brotherId = an1.id;
                      anchors.push(...[an1, an2]);
                    }
                  }
                }
              }

            }
          }
        }
        if (anchors.length > 0) {
          // 对所有的相交锚点按照lastAnchorIndex进行分组排序
          // anchors.sort((a, b) => a.lastAnchorIndex - b.lastAnchorIndex);
          // 对所有的相交锚点按照相对参考锚点的距离大小排序
          anchors.sort((a, b) => {
            if (a.lastAnchorIndex === b.lastAnchorIndex) {
              const l3 = initiativeAnchors.find(item => item.id === a.lastAnchorIndex);
              if (l3) {
                return getDistance(a.x, a.y, l3.x, l3.y) - getDistance(b.x, b.y, l3.x, l3.y);
              } else {
                return -1;
              }
            } else {
              return -1;
            }
          });
          // 处理圆弧相交的情况,超过2对及以上才需要比较
          let comparedIds = []; // 记录已经比较过距离的锚点对
          let neighbourIds = [];
          let gapOverFlag = -1; // 间距起始与结束标志位
          for (let m = 0, len = anchors.length; m < len; m++) {
            const an1 = anchors[m];
            if (comparedIds.indexOf(an1.id) !== -1) {
              continue;
            }
            const brother = anchors.find(el => el.id === an1.brotherId);
            comparedIds.push(...[an1.id, brother.id]);
            for (let n = m + 1; n < len; n++) {
              const an2 = anchors[n];
              const otherBrother = anchors.find(el => el.id === an2.brotherId);
              comparedIds.push(...[an2.id, otherBrother.id]);
              if (an1.brotherId !== an2.id) {
                if ((getDistance(an1.x, an1.y, an2.x, an2.y) < radius * 2) &&
                  (getDistance(an1.x, an1.y, an2.x, an2.y) > anchorOffsetXY)) {
                  gapOverFlag = 1;
                  if (neighbourIds.indexOf(an1.id) === -1) {
                    neighbourIds.push(...[an1.id, brother.id]);
                  }
                  const otherBrother = anchors.find(el => el.id === an2.brotherId);
                  if (neighbourIds.indexOf(an2.id) === -1) {
                    neighbourIds.push(...[an2.id, otherBrother.id]);
                  }
                } else {
                  if (gapOverFlag === 1) {
                    gapOverFlag = -1;
                    const index = comparedIds.findIndex(el => el === an2.id);
                    comparedIds.splice(index, 1);
                    const brotherIndex = comparedIds.findIndex(el => el === an2.brotherId);
                    comparedIds.splice(brotherIndex, 1);
                    break;
                  }
                  break;
                }
              }
            }
          }
          for (let k = 0; k < anchors.length; k++) {
            const an = anchors[k];
            if (
              neighbourIds.indexOf(an.id) !== -1
            ) {
              anchors.splice(k, 1);
              k--;
            }
          }
          // X,Y坐标相近的锚点成对去重
          for (let p = 0, len = anchors.length; p < len; p++) {
            const an1 = anchors[p];
            for (let o = p + 1; o < len; o++) {
              const an2 = anchors[o];
              if (getDistance(an1.x, an1.y, an2.x, an2.y) <= anchorOffsetXY) {
                anchors.splice(o, 1);
                let brotherIndex = anchors.findIndex(el => el.id === an2.brotherId);
                if (brotherIndex !== -1) {
                  anchors.splice(brotherIndex, 1);
                }
                o--;
                len = anchors.length;
              }
            }
          }
          // 对每个新增锚点按照正确的顺序插入到worldAnchors数组中
          let lastIndex = -1, index = -1, count = 0;
          for (let k = 0; k < anchors.length; k++) {
            const an = anchors[k];
            if (lastIndex === -1 || (lastIndex !== -1 && lastIndex !== an.lastAnchorIndex)) {
              // 找到相对锚点的索引
              index = ls[i].calculative.worldAnchors.findIndex(el => el.id === an.lastAnchorIndex);
              count = 0;
            } else if (lastIndex === an.lastAnchorIndex) {
              count++;
            }
            const tIndex = ls[i].calculative.worldAnchors.findIndex(el => {
              return el.x === an.x && el.y === an.y && el.penId === an.penId;
            });
            // 避免重复添加相交锚点
            if (tIndex === -1) {
              ls[i].calculative.worldAnchors.splice(index + count + 1, 0, an);
              lastIndex = an.lastAnchorIndex;
            }
          }
          (window as any).meta2d.canvas.updateLines(ls[i]);
          (window as any).meta2d.canvas.initLineRect(ls[i]);
        }
      }
      (window as any).meta2d.render();
    }, 0);
  }

}
// 销毁订阅
export function clearLineCross() {
  (window as any).meta2d.off('mouseup', mouseUp);
  (window as any).meta2d.off('mousedown', mouseDown);
  (window as any).meta2d.off('add', add);
  (window as any).meta2d.off('active', active);
  (window as any).meta2d.off('opened', opened);
  anchors = [];
}
// 判断一个点是否在一条线上
function calcIsInsideThickLineSegment(line1: any, line2: any, pnt: any, lineThickness: number) {
  const L2 = (((line2.x - line1.x) * (line2.x - line1.x)) + ((line2.y - line1.y) * (line2.y - line1.y)));
  if (L2 == 0) return false;
  const r = (((pnt.x - line1.x) * (line2.x - line1.x)) + ((pnt.y - line1.y) * (line2.y - line1.y))) / L2;

  //Assume line thickness is circular
  if (r < 0) {
    //Outside line1
    return (Math.sqrt(((line1.x - pnt.x) * (line1.x - pnt.x)) + ((line1.y - pnt.y) * (line1.y - pnt.y))) <= lineThickness);
  } else if ((0 <= r) && (r <= 1)) {
    //On the line segment
    const s = (((line1.y - pnt.y) * (line2.x - line1.x)) - ((line1.x - pnt.x) * (line2.y - line1.y))) / L2;
    return (Math.abs(s) * Math.sqrt(L2) <= lineThickness);
  } else {
    //Outside line2
    return (Math.sqrt(((line2.x - pnt.x) * (line2.x - pnt.x)) + ((line2.y - pnt.y) * (line2.y - pnt.y))) <= lineThickness);
  }
}
// 求出一条经过圆心的直线与圆的两个交点
function inteceptCircleLineSeg(circle: any, line: any) {
  let a, b, c, d, u1, u2, ret, retP1, retP2, v1, v2;
  v1 = {};
  v2 = {};
  v1.x = line.p2.x - line.p1.x;
  v1.y = line.p2.y - line.p1.y;
  v2.x = line.p1.x - circle.x;
  v2.y = line.p1.y - circle.y;
  b = (v1.x * v2.x + v1.y * v2.y);
  c = 2 * (v1.x * v1.x + v1.y * v1.y);
  b *= -2;
  d = Math.sqrt(b * b - 2 * c * (v2.x * v2.x + v2.y * v2.y - circle.radius * circle.radius));
  if (isNaN(d)) { // no intercept
    return [];
  }
  u1 = (b - d) / c;  // these represent the unit distance of point one and two on the line
  u2 = (b + d) / c;
  retP1 = {};   // return points
  retP2 = {};
  ret = []; // return array
  if (u1 <= 1 && u1 >= 0) {  // add point if on the line segment
    retP1.x = line.p1.x + v1.x * u1;
    retP1.y = line.p1.y + v1.y * u1;
    ret[0] = retP1;
  }
  if (u2 <= 1 && u2 >= 0) {  // second add point if on the line segment
    retP2.x = line.p1.x + v1.x * u2;
    retP2.y = line.p1.y + v1.y * u2;
    ret[ret.length] = retP2;
  }
  return ret;
}

// Function to find the line given two points 根据两个点返回一条直线的表达式
function lineFromPoints(p1: PurePoint, p2: PurePoint) {
  const a = p2.y - p1.y;
  const b = p1.x - p2.x;
  const c = a * (p1.x) + b * (p1.y);
  return { a, b, c };
}
// 获取两个点之间的距离
function getDistance(x1: number, y1: number, x2: number, y2: number) {
  let y = x2 - x1;
  let x = y2 - y1;

  return Math.sqrt(x * x + y * y);
}
// 检测两条线段是否相交，并返回结果
function checkLineIntersection(line1StartX: number, line1StartY: number, line1EndX: number, line1EndY: number, line2StartX: number, line2StartY: number, line2EndX, line2EndY: number) {
  // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
  let denominator, a, b, numerator1, numerator2, result = {
    x: null,
    y: null,
    onLine1: false,
    onLine2: false
  };
  denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
  if (denominator == 0) {
    return result;
  }
  a = line1StartY - line2StartY;
  b = line1StartX - line2StartX;
  numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
  numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
  a = numerator1 / denominator;
  b = numerator2 / denominator;

  // if we cast these lines infinitely in both directions, they intersect here:
  result.x = line1StartX + (a * (line1EndX - line1StartX));
  result.y = line1StartY + (a * (line1EndY - line1StartY));
  /*
        // it is worth noting that this should be the same as:
        x = line2StartX + (b * (line2EndX - line2StartX));
        y = line2StartX + (b * (line2EndY - line2StartY));
        */
  // if line1 is a segment and line2 is infinite, they intersect if:
  if (a > 0 && a < 1) {
    result.onLine1 = true;
  }
  // if line2 is a segment and line1 is infinite, they intersect if:
  if (b > 0 && b < 1) {
    result.onLine2 = true;
  }
  // if line1 and line2 are segments, they intersect if both of the above are true
  return result;
}
