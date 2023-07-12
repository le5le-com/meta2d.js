import { ColorStop, IValue, LineAnimateType, LockState, Pen } from './model';
import { getLineRect, getSplitAnchor, line } from '../diagrams';
import { Direction, inheritanceProps } from '../data';
import {
  calcRotate,
  distance,
  facePoint,
  Point,
  rotatePoint,
  scalePoint,
  translatePoint,
  TwoWay,
} from '../point';
import {
  calcCenter,
  calcRightBottom,
  calcRelativePoint,
  calcRelativeRect,
  Rect,
  rectInRect,
  scaleRect,
  translateRect,
} from '../rect';
import { globalStore, Meta2dStore } from '../store';
import { calcTextLines, calcTextDrawRect, calcTextRect } from './text';
import { deepClone } from '../utils/clone';
import { renderFromArrow, renderToArrow } from './arrow';
import { Gradient, isEqual, PenType } from '@meta2d/core';
import { rgba } from '../utils';
import { Canvas } from '../canvas';

/**
 * ancestor 是否是 pen 的祖先
 * @param pen 当前画笔
 * @param ancestor 祖先画笔
 */
export function isAncestor(pen: Pen, ancestor: Pen) {
  if (!pen || !ancestor) {
    return false;
  }
  let parent = getParent(pen);
  while (parent) {
    if (parent.id === ancestor.id) {
      return true;
    }
    parent = getParent(parent);
  }
  return false;
}

export function getParent(pen: Pen, root?: boolean): Pen {
  if (!pen || !pen.parentId || !pen.calculative) {
    return undefined;
  }

  const store = pen.calculative.canvas.store;
  const parent = store.pens[pen.parentId];
  if (!root) {
    return parent;
  }
  return getParent(parent, root) || parent;
}

export function getAllChildren(pen: Pen, store: Meta2dStore): Pen[] {
  if (!pen || !pen.children) {
    return [];
  }
  const children: Pen[] = [];
  pen.children.forEach((id) => {
    const child = store.pens[id];
    if (child) {
      children.push(child);
      children.push(...getAllChildren(child, store));
    }
  });
  return children;
}

function drawBkLinearGradient(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { worldRect, gradientFromColor, gradientToColor, gradientAngle } =
    pen.calculative;
  return linearGradient(
    ctx,
    worldRect,
    gradientFromColor,
    gradientToColor,
    gradientAngle
  );
}

/**
 * 避免副作用，把创建好后的径向渐变对象返回出来
 * @param ctx 画布绘制对象
 * @param pen 当前画笔
 * @returns 径向渐变
 */
function drawBkRadialGradient(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { worldRect, gradientFromColor, gradientToColor, gradientRadius } =
    pen.calculative;
  if (!gradientFromColor || !gradientToColor) {
    return;
  }

  const { width, height, center } = worldRect;
  const { x: centerX, y: centerY } = center;
  let r = width;
  if (r < height) {
    r = height;
  }
  r *= 0.5;
  const grd = ctx.createRadialGradient(
    centerX,
    centerY,
    r * (gradientRadius || 0),
    centerX,
    centerY,
    r
  );
  grd.addColorStop(0, gradientFromColor);
  grd.addColorStop(1, gradientToColor);

  return grd;
}

function getLinearGradientPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number
) {
  let slantAngle = 0;
  slantAngle = Math.PI / 2 - Math.atan2(y2 - y1, x2 - x1);
  const originX = (x1 + x2) / 2;
  const originY = (y1 + y2) / 2;

  const perpX1 = originX + r * Math.sin((90 * Math.PI) / 180 - slantAngle);
  const perpY1 = originY + r * -Math.cos((90 * Math.PI) / 180 - slantAngle);

  const perpX2 = originX + r * Math.sin((270 * Math.PI) / 180 - slantAngle);
  const perpY2 = originY + r * -Math.cos((270 * Math.PI) / 180 - slantAngle);

  return [perpX1, perpY1, perpX2, perpY2];
}

function getBkRadialGradient(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { worldRect, gradientColors, gradientRadius } = pen.calculative;
  if (!gradientColors) {
    return;
  }

  const { width, height, center } = worldRect;
  const { x: centerX, y: centerY } = center;
  let r = width;
  if (r < height) {
    r = height;
  }
  r *= 0.5;
  const { colors } = formatGradient(gradientColors);
  const grd = ctx.createRadialGradient(
    centerX,
    centerY,
    r * (gradientRadius || 0),
    centerX,
    centerY,
    r
  );
  colors.forEach((stop) => {
    grd.addColorStop(stop.i, stop.color);
  });

  return grd;
}

function getBkGradient(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, ex, width, height, center } = pen.calculative.worldRect;
  let points = [
    { x: ex, y: y + height / 2 },
    { x: x, y: y + height / 2 },
  ];
  const { angle, colors } = formatGradient(pen.calculative.gradientColors);
  let r = getGradientR(angle, width, height);
  points.forEach((point) => {
    rotatePoint(point, angle, center);
  });
  return getLinearGradient(ctx, points, colors, r);
}

function getGradientR(angle: number, width: number, height: number) {
  const dividAngle = (Math.atan(height / width) / Math.PI) * 180;
  let calculateAngle = (angle - 90) % 360;
  let r = 0;
  if (
    (calculateAngle > dividAngle && calculateAngle < 180 - dividAngle) ||
    (calculateAngle > 180 + dividAngle && calculateAngle < 360 - dividAngle) ||
    calculateAngle < 0
  ) {
    //根据高计算
    if (calculateAngle > 270) {
      calculateAngle = 360 - calculateAngle;
    } else if (calculateAngle > 180) {
      calculateAngle = calculateAngle - 180;
    } else if (calculateAngle > 90) {
      calculateAngle = 180 - calculateAngle;
    }
    r = Math.abs(height / Math.sin((calculateAngle / 180) * Math.PI) / 2);
  } else {
    //根据宽计算
    if (calculateAngle > 270) {
      calculateAngle = 360 - calculateAngle;
    } else if (calculateAngle > 180) {
      calculateAngle = calculateAngle - 180;
    } else if (calculateAngle > 90) {
      calculateAngle = 180 - calculateAngle;
    }
    r = Math.abs(width / Math.cos((calculateAngle / 180) * Math.PI) / 2);
  }
  return r;
}

function formatGradient(color: string) {
  if (typeof color == 'string' && color.startsWith('linear-gradient')) {
    let arr = color.slice(16, -2).split('deg,');
    if (arr.length > 1) {
      let _arr = arr[1].split('%,');
      const colors = [];
      _arr.forEach((stap) => {
        if (/rgba?/.test(stap)) {
          let _arr = stap.split(') ');
          colors.push({
            color: rgbaToHex(_arr[0] + ')'),
            i: parseFloat(_arr[1]) / 100,
          });
        } else {
          let _arr = stap.split(' ');
          if (_arr.length > 2) {
            colors.push({
              color: _arr[1],
              i: parseFloat(_arr[2]) / 100,
            });
          } else {
            colors.push({
              color: _arr[0],
              i: parseFloat(_arr[1]) / 100,
            });
          }
        }
      });
      return {
        angle: parseFloat(arr[0]),
        colors,
      };
    } else {
      return {
        angle: parseFloat(arr[0]),
        colors: [],
      };
    }
  } else {
    return {
      angle: 0,
      colors: [],
    };
  }
}

function rgbaToHex(value) {
  if (/rgba?/.test(value)) {
    let array = value.split(',');
    //不符合rgb或rgb规则直接return
    if (array.length < 3) return '';
    value = '#';
    for (let i = 0, color; (color = array[i++]); ) {
      if (i < 4) {
        //前三位转换成16进制
        color = parseInt(color.replace(/[^\d]/gi, ''), 10).toString(16);
        value += color.length == 1 ? '0' + color : color;
      } else {
        //rgba的透明度转换成16进制
        color = color.replace(')', '');
        let colorA = parseInt(color * 255 + '');
        let colorAHex = colorA.toString(16);
        value += colorAHex;
      }
    }
    value = value.toUpperCase();
  }
  return value;
}

function getLineGradient(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, ex, width, height, center } = pen.calculative.worldRect;
  let points = [
    { x: ex, y: y + height / 2 },
    { x: x, y: y + height / 2 },
  ];

  const { angle, colors } = formatGradient(pen.calculative.lineGradientColors);
  let r = getGradientR(angle, width, height);

  points.forEach((point) => {
    rotatePoint(point, angle, center);
  });
  return getLinearGradient(ctx, points, colors, r);
}

function getLinearGradient(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  colors: ColorStop[],
  radius: number
): CanvasGradient {
  let arr = getLinearGradientPoints(
    points[0].x,
    points[0].y,
    points[1].x,
    points[1].y,
    radius
  );
  let gradient = ctx.createLinearGradient(arr[0], arr[1], arr[2], arr[3]);
  colors.forEach((stop) => {
    gradient.addColorStop(stop.i, stop.color);
  });
  return gradient;
}

function drawLinearGradientLine(
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  points: Point[]
) {
  let colors = [];
  if (pen.calculative.gradientColorStop) {
    colors = pen.calculative.gradientColorStop;
  } else {
    colors = formatGradient(pen.calculative.lineGradientColors).colors;
    pen.calculative.gradientColorStop = colors;
  }
  ctx.strokeStyle = getLinearGradient(
    ctx,
    points,
    colors,
    pen.calculative.lineWidth / 2
  );
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  ctx.lineTo(points[1].x, points[1].y);
  ctx.stroke();
}

function ctxDrawLinearGradientPath(ctx: CanvasRenderingContext2D, pen: Pen) {
  const anchors = pen.calculative.worldAnchors;
  let smoothLenth =
    pen.calculative.lineWidth * (pen.calculative.gradientSmooth || 0);
  for (let i = 0; i < anchors.length - 1; i++) {
    if (
      (pen.lineName === 'curve' || pen.lineName === 'mind') &&
      anchors[i].curvePoints
    ) {
      if (i > 0) {
        let lastCurvePoints = anchors[i - 1].curvePoints;
        if (lastCurvePoints) {
          //上一个存在锚点
          smoothTransition(
            ctx,
            pen,
            smoothLenth,
            lastCurvePoints[lastCurvePoints.length - 1],
            anchors[i],
            anchors[i].curvePoints[0]
          );
        } else {
          smoothTransition(
            ctx,
            pen,
            smoothLenth,
            anchors[i - 1],
            anchors[i],
            anchors[i].curvePoints[0]
          );
        }
        //获取当前相对于0的位置
        let next = getSmoothAdjacent(
          smoothLenth,
          anchors[i],
          anchors[i].curvePoints[0]
        );
        drawLinearGradientLine(ctx, pen, [next, anchors[i].curvePoints[1]]);
      } else {
        drawLinearGradientLine(ctx, pen, [
          anchors[i],
          anchors[i].curvePoints[0],
        ]);
        drawLinearGradientLine(ctx, pen, [
          anchors[i].curvePoints[0],
          anchors[i].curvePoints[1],
        ]);
      }
      let len = anchors[i].curvePoints.length - 1;
      for (let j = 1; j < len; j++) {
        drawLinearGradientLine(ctx, pen, [
          anchors[i].curvePoints[j],
          anchors[i].curvePoints[j + 1],
        ]);
      }
      let last = getSmoothAdjacent(
        smoothLenth,
        anchors[i + 1],
        anchors[i].curvePoints[len]
      );
      drawLinearGradientLine(ctx, pen, [anchors[i].curvePoints[len], last]);
    } else {
      let _next = anchors[i];
      let _last = anchors[i + 1];
      if (i > 0 && i < anchors.length - 1) {
        //有突兀的地方
        let lastCurvePoints = anchors[i - 1].curvePoints;
        if (lastCurvePoints) {
          smoothTransition(
            ctx,
            pen,
            smoothLenth,
            lastCurvePoints[lastCurvePoints.length - 1],
            anchors[i],
            anchors[i + 1]
          );
        } else {
          smoothTransition(
            ctx,
            pen,
            smoothLenth,
            anchors[i - 1],
            anchors[i],
            anchors[i + 1]
          );
        }
      }
      if (i > 0 && i < anchors.length - 1) {
        _next = getSmoothAdjacent(smoothLenth, anchors[i], anchors[i + 1]);
      }
      if (i < anchors.length - 2) {
        _last = getSmoothAdjacent(smoothLenth, anchors[i + 1], anchors[i]);
      }
      drawLinearGradientLine(ctx, pen, [_next, _last]);
    }
  }
}

function getSmoothAdjacent(smoothLenth: number, p1: Point, p2: Point) {
  let nexLength = Math.sqrt(
    (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y)
  );
  if (smoothLenth < nexLength) {
    return {
      x: p1.x + ((p2.x - p1.x) * smoothLenth) / nexLength,
      y: p1.y + ((p2.y - p1.y) * smoothLenth) / nexLength,
    };
  } else {
    return {
      x: p1.x + (p2.x - p1.x) / nexLength / 2,
      y: p1.y + (p2.y - p1.y) / nexLength / 2,
    };
  }
}

function smoothTransition(
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  smoothLenth: number,
  p1: Point,
  p2: Point,
  p3: Point
) {
  let last = getSmoothAdjacent(smoothLenth, p2, p1);
  let next = getSmoothAdjacent(smoothLenth, p2, p3);
  let contrlPoint = { x: p2.x, y: p2.y };

  let points = getBezierPoints(100, last, contrlPoint, next);
  for (let k = 0; k < points.length - 1; k++) {
    drawLinearGradientLine(ctx, pen, [
      {
        x: points[k].x,
        y: points[k].y,
      },
      {
        x: points[k + 1].x,
        y: points[k + 1].y,
      },
    ]);
  }
}

function smoothAnimateTransition(
  ctx: Path2D,
  smoothLenth: number,
  p2: Point,
  p3: Point
) {
  let next = getSmoothAdjacent(smoothLenth, p2, p3);
  let contrlPoint = { x: p2.x, y: p2.y };

  ctx.quadraticCurveTo(contrlPoint.x, contrlPoint.y, next.x, next.y);
}

function getGradientAnimatePath(pen: Pen) {
  const anchors = pen.calculative.worldAnchors;
  let smoothLenth =
    pen.calculative.lineWidth * (pen.calculative.gradientSmooth || 0);
  //只创建一次
  const _path = new Path2D();
  for (let i = 0; i < anchors.length - 1; i++) {
    let _next = anchors[i];
    let _last = anchors[i + 1];
    if (i == 0) {
      _path.moveTo(anchors[i].x, anchors[i].y);
    }
    if (i > 0 && i < anchors.length - 1) {
      //有突兀的地方
      let lastCurvePoints = anchors[i - 1].curvePoints;
      // const path = new Path2D();
      if (lastCurvePoints) {
        smoothAnimateTransition(_path, smoothLenth, anchors[i], anchors[i + 1]);
      } else {
        smoothAnimateTransition(_path, smoothLenth, anchors[i], anchors[i + 1]);
      }
    }
    if (i > 0 && i < anchors.length - 1) {
      _next = getSmoothAdjacent(smoothLenth, anchors[i], anchors[i + 1]);
    }
    if (i < anchors.length - 2) {
      _last = getSmoothAdjacent(smoothLenth, anchors[i + 1], anchors[i]);
    }
    _path.lineTo(_last.x, _last.y);
  }

  return _path;
}

function getAngle(p1: Point, p2: Point, p3: Point) {
  let a = { x: 0, y: 0 },
    b = { x: 0, y: 0 };
  a.x = p1.x - p2.x;
  a.y = p1.y - p2.y;
  b.x = p3.x - p2.x;
  b.y = p3.y - p2.y;

  return (
    (Math.acos(
      (a.x * b.x + a.y * b.y) /
        (Math.sqrt(a.x * a.x + a.y * a.y) * Math.sqrt(b.x * b.x + b.y * b.y))
    ) /
      Math.PI) *
    180
  );
}

function getBezierPoints(
  num = 100,
  p1?: Point,
  p2?: Point,
  p3?: Point,
  p4?: Point
) {
  let func = null;
  const points = [];
  if (!p3 && !p4) {
    func = oneBezier;
  } else if (p3 && !p4) {
    func = twoBezier;
  } else if (p3 && p4) {
    func = threeBezier;
  }
  for (let i = 0; i < num; i++) {
    points.push(func(i / num, p1, p2, p3, p4));
  }
  if (p4) {
    points.push(p4);
  } else if (p3) {
    points.push(p3);
  }
  return points;
}

/**
 * @desc 一阶贝塞尔
 * @param  t 当前百分比
 * @param  p1 起点坐标
 * @param  p2 终点坐标
 */
function oneBezier(t: number, p1: Point, p2: Point) {
  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;
  let x = x1 + (x2 - x1) * t;
  let y = y1 + (y2 - y1) * t;
  return { x, y };
}

/**
 * @desc 二阶贝塞尔
 * @param  t 当前百分比
 * @param  p1 起点坐标
 * @param  p2 终点坐标
 * @param  cp 控制点
 */
function twoBezier(t: number, p1: Point, cp: Point, p2: Point) {
  const { x: x1, y: y1 } = p1;
  const { x: cx, y: cy } = cp;
  const { x: x2, y: y2 } = p2;
  let x = (1 - t) * (1 - t) * x1 + 2 * t * (1 - t) * cx + t * t * x2;
  let y = (1 - t) * (1 - t) * y1 + 2 * t * (1 - t) * cy + t * t * y2;
  return { x, y };
}

/**
 * @desc 三阶贝塞尔
 * @param  t 当前百分比
 * @param  p1 起点坐标
 * @param  p2 终点坐标
 * @param  cp1 控制点1
 * @param  cp2 控制点2
 */
function threeBezier(t: number, p1: Point, cp1: Point, cp2: Point, p2: Point) {
  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;
  const { x: cx1, y: cy1 } = cp1;
  const { x: cx2, y: cy2 } = cp2;
  let x =
    x1 * (1 - t) * (1 - t) * (1 - t) +
    3 * cx1 * t * (1 - t) * (1 - t) +
    3 * cx2 * t * t * (1 - t) +
    x2 * t * t * t;
  let y =
    y1 * (1 - t) * (1 - t) * (1 - t) +
    3 * cy1 * t * (1 - t) * (1 - t) +
    3 * cy2 * t * t * (1 - t) +
    y2 * t * t * t;
  return { x, y };
}

function strokeLinearGradient(ctx: CanvasRenderingContext2D, pen: Pen) {
  const {
    worldRect,
    lineGradientFromColor,
    lineGradientToColor,
    lineGradientAngle,
  } = pen.calculative;
  return linearGradient(
    ctx,
    worldRect,
    lineGradientFromColor,
    lineGradientToColor,
    lineGradientAngle
  );
}

/**
 * 避免副作用，把创建好后的线性渐变对象返回出来
 * @param ctx 画布绘制对象
 * @param worldRect 世界坐标
 * @returns 线性渐变
 */
function linearGradient(
  ctx: CanvasRenderingContext2D,
  worldRect: Rect,
  fromColor: string,
  toColor: string,
  angle: number
) {
  if (!fromColor || !toColor) {
    return;
  }

  const { x, y, center, ex, ey } = worldRect;
  const from: Point = {
    x,
    y: center.y,
  };
  const to: Point = {
    x: ex,
    y: center.y,
  };
  if (angle % 90 === 0 && angle % 180) {
    from.x = center.x;
    to.x = center.x;
    if (angle % 270) {
      from.y = y;
      to.y = ey;
    } else {
      from.y = ey;
      to.y = y;
    }
  } else if (angle) {
    rotatePoint(from, angle, worldRect.center);
    rotatePoint(to, angle, worldRect.center);
  }

  // contributor: https://github.com/sunnyguohua/meta2d
  const grd = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  grd.addColorStop(0, fromColor);
  grd.addColorStop(1, toColor);
  return grd;
}

/**
 * 根据图片的宽高， imageRatio iconAlign 来获取图片的实际位置
 * @param pen 画笔
 */
function getImagePosition(pen: Pen) {
  const {
    worldIconRect: rect,
    iconWidth,
    iconHeight,
    imgNaturalWidth,
    imgNaturalHeight,
  } = pen.calculative;
  let { x, y, width: w, height: h } = rect;
  if (iconWidth) {
    w = iconWidth;
  }
  if (iconHeight) {
    h = iconHeight;
  }
  if (imgNaturalWidth && imgNaturalHeight && pen.imageRatio) {
    const scaleW = rect.width / imgNaturalWidth;
    const scaleH = rect.height / imgNaturalHeight;
    const scaleMin = Math.min(scaleW, scaleH);
    const wDivideH = imgNaturalWidth / imgNaturalHeight;
    if (iconWidth) {
      h = iconWidth / wDivideH;
    } else if (iconHeight) {
      w = iconHeight * wDivideH;
    } else {
      w = scaleMin * imgNaturalWidth;
      h = scaleMin * imgNaturalHeight;
    }
  }
  x += (rect.width - w) / 2;
  y += (rect.height - h) / 2;

  switch (pen.iconAlign) {
    case 'top':
      y = rect.y;
      break;
    case 'bottom':
      y = rect.ey - h;
      break;
    case 'left':
      x = rect.x;
      break;
    case 'right':
      x = rect.ex - w;
      break;
    case 'left-top':
      x = rect.x;
      y = rect.y;
      break;
    case 'right-top':
      x = rect.ex - w;
      y = rect.y;
      break;
    case 'left-bottom':
      x = rect.x;
      y = rect.ey - h;
      break;
    case 'right-bottom':
      x = rect.ex - w;
      y = rect.ey - h;
      break;
  }

  return {
    x,
    y,
    width: w,
    height: h,
  };
}

export function drawImage(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen
) {
  const { x, y, width, height } = getImagePosition(pen);
  const { worldIconRect, iconRotate, img } = pen.calculative;

  if (iconRotate) {
    const { x: centerX, y: centerY } = worldIconRect.center;
    ctx.translate(centerX, centerY);
    ctx.rotate((iconRotate * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }
  if (pen.imageRadius) {
    ctx.save();
    let wr = pen.calculative.imageRadius || 0,
      hr = wr;
    const {
      x: _x,
      y: _y,
      width: w,
      height: h,
      ex,
      ey,
    } = pen.calculative.worldRect;
    if (wr < 1) {
      wr = w * wr;
      hr = h * hr;
    }
    let r = wr < hr ? wr : hr;
    if (w < 2 * r) {
      r = w / 2;
    }
    if (h < 2 * r) {
      r = h / 2;
    }
    ctx.beginPath();

    ctx.moveTo(_x + r, _y);
    ctx.arcTo(ex, _y, ex, ey, r);
    ctx.arcTo(ex, ey, _x, ey, r);
    ctx.arcTo(_x, ey, _x, _y, r);
    ctx.arcTo(_x, _y, ex, _y, r);
    ctx.clip();
    ctx.drawImage(img, x, y, width, height);
    ctx.restore();
  } else {
    ctx.drawImage(img, x, y, width, height);
  }
}

/**
 * 获取文字颜色， textColor 优先其次 color
 */
export function getTextColor(pen: Pen, store: Meta2dStore) {
  const { textColor, color } = pen.calculative;
  const { data, options } = store;
  return (
    textColor ||
    color ||
    data.textColor ||
    data.color ||
    options.textColor ||
    options.color
  );
}

function drawText(ctx: CanvasRenderingContext2D, pen: Pen) {
  const {
    fontStyle,
    fontWeight,
    fontSize,
    fontFamily,
    lineHeight,
    text,
    hiddenText,
    canvas,
    textHasShadow,
    textBackground,
  } = pen.calculative;
  if (text == undefined || hiddenText) {
    return;
  }
  const store = canvas.store;
  ctx.save();
  if (!textHasShadow) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  let fill: string = undefined;
  if (pen.calculative.hover) {
    fill = pen.hoverTextColor || pen.hoverColor || store.options.hoverColor;
  } else if (pen.calculative.active) {
    fill = pen.activeTextColor || pen.activeColor || store.options.activeColor;
  }
  ctx.fillStyle = fill || getTextColor(pen, store);

  ctx.font = getFont({
    fontStyle,
    fontWeight,
    fontFamily: fontFamily || store.options.fontFamily,
    fontSize,
    lineHeight,
  });

  !pen.calculative.textDrawRect && calcTextDrawRect(ctx, pen);
  const {
    x: drawRectX,
    y: drawRectY,
    width,
    height,
  } = pen.calculative.textDrawRect;
  if (textBackground) {
    ctx.save();
    ctx.fillStyle = textBackground;
    ctx.fillRect(drawRectX, drawRectY, width, height);
    ctx.restore();
  }

  const y = 0.55;
  const textAlign = pen.textAlign || store.options.textAlign;
  const oneRowHeight = fontSize * lineHeight;
  pen.calculative.textLines.forEach((text, i) => {
    const textLineWidth = pen.calculative.textLineWidths[i];
    let x = 0;
    if (textAlign === 'center') {
      x = (width - textLineWidth) / 2;
    } else if (textAlign === 'right') {
      x = width - textLineWidth;
    }
    ctx.fillText(text, drawRectX + x, drawRectY + (i + y) * oneRowHeight);
  });

  ctx.restore();
}

function drawFillText(ctx: CanvasRenderingContext2D, pen: Pen, text: string) {
  if (text == undefined) {
    return;
  }

  const { fontStyle, fontWeight, fontSize, fontFamily, lineHeight, canvas } =
    pen.calculative;

  const store = canvas.store;
  ctx.save();

  let fill: string = undefined;
  if (pen.calculative.hover) {
    fill = pen.hoverTextColor || pen.hoverColor || store.options.hoverColor;
  } else if (pen.calculative.active) {
    fill = pen.activeTextColor || pen.activeColor || store.options.activeColor;
  }
  ctx.fillStyle = fill || getTextColor(pen, store);

  ctx.font = getFont({
    fontStyle,
    fontWeight,
    fontFamily: fontFamily || store.options.fontFamily,
    fontSize,
    lineHeight,
  });

  const w = ctx.measureText(text).width;
  let t: string;

  let prev: Point;
  for (const anchor of pen.calculative.worldAnchors) {
    if (!prev) {
      prev = anchor;
      continue;
    }

    const dis = distance(prev, anchor);

    const n = Math.floor(dis / w);
    t = '';
    for (let i = 0; i < n; i++) {
      t += text;
    }

    const angle = calcRotate(prev, anchor) - 270;
    ctx.save();
    if (angle % 360 !== 0) {
      const { x, y } = prev;
      ctx.translate(x, y);
      let rotate = (angle * Math.PI) / 180;
      ctx.rotate(rotate);
      ctx.translate(-x, -y);
    }
    ctx.fillText(t, prev.x, prev.y + lineHeight / 2);
    ctx.restore();
    prev = anchor;
  }

  ctx.restore();
}

export function drawIcon(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen
) {
  const store = pen.calculative.canvas.store;
  ctx.save();
  ctx.shadowColor = '';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const iconRect = pen.calculative.worldIconRect;
  let x = iconRect.x + iconRect.width / 2;
  let y = iconRect.y + iconRect.height / 2;

  switch (pen.iconAlign) {
    case 'top':
      y = iconRect.y;
      ctx.textBaseline = 'top';
      break;
    case 'bottom':
      y = iconRect.ey;
      ctx.textBaseline = 'bottom';
      break;
    case 'left':
      x = iconRect.x;
      ctx.textAlign = 'left';
      break;
    case 'right':
      x = iconRect.ex;
      ctx.textAlign = 'right';
      break;
    case 'left-top':
      x = iconRect.x;
      y = iconRect.y;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      break;
    case 'right-top':
      x = iconRect.ex;
      y = iconRect.y;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      break;
    case 'left-bottom':
      x = iconRect.x;
      y = iconRect.ey;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      break;
    case 'right-bottom':
      x = iconRect.ex;
      y = iconRect.ey;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      break;
  }

  const fontWeight = pen.calculative.iconWeight;
  let fontSize: number = undefined;
  const fontFamily = pen.calculative.iconFamily;
  if (pen.calculative.iconSize > 0) {
    fontSize = pen.calculative.iconSize;
  } else if (iconRect.width > iconRect.height) {
    fontSize = iconRect.height;
  } else {
    fontSize = iconRect.width;
  }
  ctx.font = getFont({
    fontSize,
    fontWeight,
    fontFamily,
  });
  ctx.fillStyle = pen.calculative.iconColor || getTextColor(pen, store);

  if (pen.calculative.iconRotate) {
    ctx.translate(iconRect.center.x, iconRect.center.y);
    ctx.rotate((pen.calculative.iconRotate * Math.PI) / 180);
    ctx.translate(-iconRect.center.x, -iconRect.center.y);
  }

  ctx.beginPath();
  ctx.fillText(pen.calculative.icon, x, y);
  ctx.restore();
}

/**
 * canvas2svg 中对 font 的解析规则比 canvas 中简单，能识别的类型很少
 * @returns ctx.font
 */
export function getFont({
  fontStyle = 'normal',
  textDecoration = 'normal',
  fontWeight = 'normal',
  fontSize = 12,
  fontFamily = 'Arial',
  lineHeight = 1, // TODO: lineHeight 默认值待测试
}: {
  fontStyle?: string;
  textDecoration?: string;
  fontWeight?: string;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
} = {}) {
  return `${fontStyle} ${textDecoration} ${fontWeight} ${fontSize}px/${lineHeight} ${fontFamily}`;
}

// TODO: 0.5 偏移量在 图片中可能存在问题
export function ctxFlip(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen
) {
  // worldRect 可能为 undefined
  const { x, ex, y, ey } = pen.calculative.worldRect || {};
  if (pen.calculative.flipX) {
    ctx.translate(x + ex + 0.5, 0.5);
    ctx.scale(-1, 1);
  }
  if (pen.calculative.flipY) {
    ctx.translate(0.5, y + ey + 0.5);
    ctx.scale(1, -1);
  }
}

export function ctxRotate(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  noFlip: boolean = false
) {
  const { x, y } = pen.calculative.worldRect.center;
  ctx.translate(x, y);
  let rotate = (pen.calculative.rotate * Math.PI) / 180;
  // 目前只有水平和垂直翻转，都需要 * -1
  if (!noFlip) {
    if (pen.calculative.flipX) {
      rotate *= -1;
    }
    if (pen.calculative.flipY) {
      rotate *= -1;
    }
  }
  ctx.rotate(rotate);
  ctx.translate(-x, -y);
}

export function renderPen(ctx: CanvasRenderingContext2D, pen: Pen) {
  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.beginPath();
  const store = pen.calculative.canvas.store;
  const textFlip = pen.textFlip || store.options.textFlip;
  const textRotate = pen.textRotate || store.options.textRotate;
  if (!textFlip || !textRotate) {
    ctx.save();
  }
  ctxFlip(ctx, pen);

  if (pen.calculative.rotate && pen.name !== 'line') {
    ctxRotate(ctx, pen);
  }

  if (pen.calculative.lineWidth > 1) {
    ctx.lineWidth = pen.calculative.lineWidth;
  }

  inspectRect(ctx, store, pen); // 审查 rect
  let fill: any;
  // 该变量控制在 hover active 状态下的节点是否设置填充颜色
  let setBack = true;
  let lineGradientFlag = false;
  if (pen.calculative.hover) {
    ctx.strokeStyle = pen.hoverColor || store.options.hoverColor;
    fill = pen.hoverBackground || store.options.hoverBackground;
    ctx.fillStyle = fill;
    fill && (setBack = false);
  } else if (pen.calculative.active) {
    ctx.strokeStyle = pen.activeColor || store.options.activeColor;
    fill = pen.activeBackground || store.options.activeBackground;
    ctx.fillStyle = fill;
    fill && (setBack = false);
  } else if (pen.calculative.isDock) {
    if (pen.type === PenType.Line) {
      ctx.strokeStyle = store.options.dockPenColor;
    } else {
      fill = rgba(store.options.dockPenColor, 0.2);
      ctx.fillStyle = fill;
      fill && (setBack = false);
    }
  } else {
    const strokeImg = pen.calculative.strokeImg;
    if (pen.calculative.strokeImage && strokeImg) {
      ctx.strokeStyle = ctx.createPattern(strokeImg, 'repeat');
      fill = true;
    } else {
      let stroke: string | CanvasGradient | CanvasPattern;
      // TODO: 线只有线性渐变
      if (pen.calculative.strokeType) {
        if (pen.calculative.lineGradientColors) {
          if (pen.name === 'line') {
            lineGradientFlag = true;
          } else {
            if (pen.calculative.lineGradient) {
              stroke = pen.calculative.lineGradient;
            } else {
              stroke = getLineGradient(ctx, pen);
              pen.calculative.lineGradient = stroke;
            }
          }
        } else {
          stroke = strokeLinearGradient(ctx, pen);
        }
      } else {
        stroke = pen.calculative.color || getGlobalColor(store);
      }
      ctx.strokeStyle = stroke;
    }
  }
  if (setBack) {
    const backgroundImg = pen.calculative.backgroundImg;
    if (pen.calculative.backgroundImage && backgroundImg) {
      ctx.fillStyle = ctx.createPattern(backgroundImg, 'repeat');
      fill = true;
    } else {
      let back: string | CanvasGradient | CanvasPattern;
      if (pen.calculative.bkType === Gradient.Linear) {
        if (pen.calculative.gradientColors) {
          if (pen.name !== 'line') {
            //连线不考虑渐进背景
            if (pen.calculative.gradient) {
              //位置变化/放大缩小操作不会触发重新计算
              back = pen.calculative.gradient;
            } else {
              back = getBkGradient(ctx, pen);
              pen.calculative.gradient = back;
            }
          }
        } else {
          back = drawBkLinearGradient(ctx, pen);
        }
      } else if (pen.calculative.bkType === Gradient.Radial) {
        if (pen.calculative.gradientColors) {
          if (pen.calculative.radialGradient) {
            back = pen.calculative.radialGradient;
          } else {
            back = getBkRadialGradient(ctx, pen);
            pen.calculative.radialGradient = back;
          }
        } else {
          back = drawBkRadialGradient(ctx, pen);
        }
      } else {
        back = pen.calculative.background || store.data.penBackground;
      }
      ctx.fillStyle = back;
      fill = !!back;
    }
  }

  setLineCap(ctx, pen);
  setLineJoin(ctx, pen);

  setGlobalAlpha(ctx, pen);

  if (pen.calculative.lineDash) {
    ctx.setLineDash(pen.calculative.lineDash);
  }
  if (pen.calculative.lineDashOffset) {
    ctx.lineDashOffset = pen.calculative.lineDashOffset;
  }

  if (pen.calculative.shadowColor) {
    ctx.shadowColor = pen.calculative.shadowColor;
    ctx.shadowOffsetX = pen.calculative.shadowOffsetX;
    ctx.shadowOffsetY = pen.calculative.shadowOffsetY;
    ctx.shadowBlur = pen.calculative.shadowBlur;
  }
  if (lineGradientFlag) {
    ctxDrawLinearGradientPath(ctx, pen);
    ctxDrawLinePath(true, ctx, pen, store);
  } else {
    ctxDrawPath(true, ctx, pen, store, fill);

    ctxDrawCanvas(ctx, pen);
  }
  if (!(pen.image && pen.calculative.img) && pen.calculative.icon) {
    drawIcon(ctx, pen);
  }

  if (!textFlip || !textRotate) {
    ctx.restore();
  }
  if (textFlip && !textRotate) {
    ctxFlip(ctx, pen);
  }
  if (!textFlip && textRotate) {
    if (pen.calculative.rotate && pen.name !== 'line') {
      ctxRotate(ctx, pen, true);
    }
  }

  drawText(ctx, pen);

  if (pen.type === PenType.Line && pen.fillTexts) {
    for (const text of pen.fillTexts) {
      drawFillText(ctx, pen, text);
    }
  }

  ctx.restore();
}

/**
 * 更改 ctx 的 lineCap 属性
 */
export function setLineCap(ctx: CanvasRenderingContext2D, pen: Pen) {
  const lineCap = pen.lineCap || (pen.type ? 'round' : 'square');
  if (lineCap) {
    ctx.lineCap = lineCap;
  } else if (pen.type) {
    ctx.lineCap = 'round';
  }
}

/**
 * 更改 ctx 的 lineJoin 属性
 */
export function setLineJoin(ctx: CanvasRenderingContext2D, pen: Pen) {
  const lineJoin = pen.lineJoin;
  if (lineJoin) {
    ctx.lineJoin = lineJoin;
  } else if (pen.type) {
    ctx.lineJoin = 'round';
  }
}

/**
 * 通常用在下载 svg
 * canvas2svg 与 canvas ctx 设置 strokeStyle 表现不同
 * 若设置值为 undefined ，canvas2svg 为空， canvas ctx 为上一个值
 */
export function renderPenRaw(
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  rect?: Rect
) {
  ctx.save();
  if (rect) {
    ctx.translate(-rect.x, -rect.y);
  }

  // for canvas2svg
  (ctx as any).setAttrs?.(pen);
  // end
  const store = pen.calculative.canvas.store;
  const textFlip = pen.textFlip || store.options.textFlip;
  const textRotate = pen.textRotate || store.options.textRotate;
  ctx.beginPath();
  if (!textFlip || !textRotate) {
    ctx.save();
  }
  if (pen.calculative.flipX) {
    if (rect) {
      ctx.translate(
        pen.calculative.worldRect.x + pen.calculative.worldRect.ex,
        0
      );
    } else {
      ctx.translate(
        pen.calculative.worldRect.x + pen.calculative.worldRect.ex,
        0
      );
    }
    ctx.scale(-1, 1);
  }
  if (pen.calculative.flipY) {
    if (rect) {
      ctx.translate(
        0,
        pen.calculative.worldRect.y + pen.calculative.worldRect.ey
      );
    } else {
      ctx.translate(
        0,
        pen.calculative.worldRect.y + pen.calculative.worldRect.ey
      );
    }
    ctx.scale(1, -1);
  }

  if (pen.calculative.rotate && pen.name !== 'line') {
    ctxRotate(ctx, pen);
  }

  if (pen.calculative.lineWidth > 1) {
    ctx.lineWidth = pen.calculative.lineWidth;
  }
  let fill: any;
  if (pen.calculative.hover) {
    ctx.strokeStyle = pen.hoverColor || store.options.hoverColor;
    ctx.fillStyle = pen.hoverBackground || store.options.hoverBackground;
    fill = pen.hoverBackground || store.options.hoverBackground;
  } else if (pen.calculative.active) {
    ctx.strokeStyle = pen.activeColor || store.options.activeColor;
    ctx.fillStyle = pen.activeBackground || store.options.activeBackground;
    fill = pen.activeBackground || store.options.activeBackground;
  } else {
    if (pen.strokeImage) {
      if (pen.calculative.strokeImg) {
        ctx.strokeStyle = ctx.createPattern(
          pen.calculative.strokeImg,
          'repeat'
        );
        fill = true;
      }
    } else {
      ctx.strokeStyle = pen.calculative.color || getGlobalColor(store);
    }

    if (pen.backgroundImage) {
      if (pen.calculative.backgroundImg) {
        ctx.fillStyle = ctx.createPattern(
          pen.calculative.backgroundImg,
          'repeat'
        );
        fill = true;
      }
    } else {
      ctx.fillStyle = pen.background;
      fill = !!pen.background;
    }
  }

  setLineCap(ctx, pen);
  setLineJoin(ctx, pen);

  setGlobalAlpha(ctx, pen);

  if (pen.calculative.lineDash) {
    ctx.setLineDash(pen.calculative.lineDash);
  }
  if (pen.calculative.lineDashOffset) {
    ctx.lineDashOffset = pen.calculative.lineDashOffset;
  }

  if (pen.calculative.shadowColor) {
    ctx.shadowColor = pen.calculative.shadowColor;
    ctx.shadowOffsetX = pen.calculative.shadowOffsetX;
    ctx.shadowOffsetY = pen.calculative.shadowOffsetY;
    ctx.shadowBlur = pen.calculative.shadowBlur;
  }

  ctxDrawPath(false, ctx, pen, store, fill);

  ctxDrawCanvas(ctx, pen);

  // renderPenRaw 用在 downloadPng svg , echarts 等图形需要
  if (pen.calculative.img) {
    ctx.save();
    ctx.shadowColor = '';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    drawImage(ctx, pen);
    ctx.restore();
  } else if (pen.calculative.icon) {
    drawIcon(ctx, pen);
  }

  if (!textFlip || !textRotate) {
    ctx.restore();
  }

  if (textFlip && !textRotate) {
    if (pen.calculative.flipX) {
      if (rect) {
        ctx.translate(
          pen.calculative.worldRect.x + pen.calculative.worldRect.ex,
          0
        );
      } else {
        ctx.translate(
          pen.calculative.worldRect.x + pen.calculative.worldRect.ex,
          0
        );
      }
      ctx.scale(-1, 1);
    }
    if (pen.calculative.flipY) {
      if (rect) {
        ctx.translate(
          0,
          pen.calculative.worldRect.y + pen.calculative.worldRect.ey
        );
      } else {
        ctx.translate(
          0,
          pen.calculative.worldRect.y + pen.calculative.worldRect.ey
        );
      }
      ctx.scale(1, -1);
    }
  }
  if (!textFlip && textRotate) {
    if (pen.calculative.rotate && pen.name !== 'line') {
      ctxRotate(ctx, pen, true);
    }
  }

  drawText(ctx, pen);

  if (pen.type === PenType.Line && pen.fillTexts) {
    for (const text of pen.fillTexts) {
      drawFillText(ctx, pen, text);
    }
  }

  ctx.restore();
}

/**
 * 根据 path2D 绘制 path
 * @param canUsePath 是否可使用 Path2D, downloadSvg 不可使用 path2D
 */
export function ctxDrawPath(
  canUsePath = true,
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore,
  fill: boolean
) {
  const path = canUsePath
    ? store.path2dMap.get(pen)
    : globalStore.path2dDraws[pen.name];
  if (path) {
    if (pen.type === PenType.Line && pen.borderWidth) {
      ctx.save();
      ctx.beginPath();
      const lineWidth = pen.calculative.lineWidth + pen.calculative.borderWidth;
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = pen.borderColor;
      if (path instanceof Path2D) {
        fill && ctx.fill(path);
        lineWidth && ctx.stroke(path);
      } else {
        path(pen, ctx);
        fill && ctx.fill();
        lineWidth && ctx.stroke();
      }
      ctx.restore();
    }
    if (path instanceof Path2D) {
      fill && ctx.fill(path);
    } else {
      ctx.save();
      path(pen, ctx);
      fill && ctx.fill();
      ctx.restore();
    }

    const progress = pen.calculative.progress;
    if (progress != null) {
      ctx.save();
      const { x, y, width, height, ey } = pen.calculative.worldRect;
      const grd = !pen.verticalProgress
        ? ctx.createLinearGradient(x, y, x + width * progress, y)
        : ctx.createLinearGradient(x, ey, x, y + height * (1 - progress));
      const color =
        pen.calculative.progressColor ||
        pen.calculative.color ||
        store.options.activeColor;
      grd.addColorStop(0, color);
      grd.addColorStop(1, color);
      grd.addColorStop(1, 'transparent');

      ctx.fillStyle = grd;
      if (path instanceof Path2D) {
        ctx.fill(path);
      } else {
        path(pen, ctx);
        ctx.fill();
      }
      ctx.restore();
    }

    if (pen.calculative.lineWidth) {
      if (path instanceof Path2D) {
        ctx.stroke(path);
      } else {
        path(pen, ctx);
        ctx.stroke();
      }
    }

    if (pen.type) {
      if (pen.calculative.animatePos) {
        ctx.save();
        setCtxLineAnimate(ctx, pen, store);
        if (path instanceof Path2D) {
          ctx.stroke(path);
        } else {
          path(pen, ctx);
          ctx.stroke();
        }
        ctx.restore();
      }

      pen.fromArrow && renderFromArrow(ctx, pen, store);
      pen.toArrow && renderToArrow(ctx, pen, store);

      if (pen.calculative.active && !pen.calculative.pencil) {
        renderLineAnchors(ctx, pen);
      }
    }
  }
}

/**
 * 连线配置线条渐进后，动画效果、起始点、终点的绘制
 */
export function ctxDrawLinePath(
  canUsePath = true,
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore
) {
  const path = canUsePath
    ? store.path2dMap.get(pen)
    : globalStore.path2dDraws[pen.name];
  if (path) {
    if (pen.type) {
      if (pen.calculative.animatePos) {
        ctx.save();
        setCtxLineAnimate(ctx, pen, store);
        ctx.beginPath();
        if (path instanceof Path2D) {
          //是否设置了平滑度
          if (
            pen.calculative.gradientSmooth &&
            (pen.lineName === 'polyline' || pen.lineName === 'line')
          ) {
            if (!pen.calculative.gradientAnimatePath) {
              pen.calculative.gradientAnimatePath = getGradientAnimatePath(pen);
            }
            if (pen.calculative.gradientAnimatePath instanceof Path2D) {
              ctx.stroke(pen.calculative.gradientAnimatePath);
            }
          } else {
            ctx.stroke(path);
          }
        } else {
          path(pen, ctx);
          ctx.stroke();
        }
        ctx.restore();
      }

      pen.fromArrow && renderFromArrow(ctx, pen, store);
      pen.toArrow && renderToArrow(ctx, pen, store);
      //TODO 锚点处渐进色的过渡
      if (pen.calculative.active && !pen.calculative.pencil) {
        renderLineAnchors(ctx, pen);
      }
    }
  }
}

/**
 * 设置线条动画，ctx 的 strokeStyle lineDash 等属性更改
 */
export function setCtxLineAnimate(
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore
) {
  ctx.strokeStyle = pen.animateColor || store.options.animateColor;
  pen.calculative.animateLineWidth &&
    (ctx.lineWidth = pen.calculative.animateLineWidth * store.data.scale);
  let len = 0;
  switch (pen.lineAnimateType) {
    case LineAnimateType.Beads:
      if (pen.animateReverse) {
        ctx.lineDashOffset = pen.calculative.animatePos;
      } else {
        ctx.lineDashOffset = pen.length - pen.calculative.animatePos;
      }
      len = pen.calculative.lineWidth || 5;
      if (len < 5) {
        len = 5;
      }
      const dash =
        pen.animateLineDash &&
        pen.animateLineDash.map((item) => (item * len) / 5);
      ctx.setLineDash(dash || [len, len * 2]);
      break;
    case LineAnimateType.Dot:
      if (pen.animateReverse) {
        ctx.lineDashOffset = pen.calculative.animatePos;
      } else {
        ctx.lineDashOffset = pen.length - pen.calculative.animatePos;
      }
      len =
        pen.calculative.animateDotSize || pen.calculative.lineWidth * 2 || 6;
      if (len < 6) {
        len = 6;
      }
      ctx.lineWidth =
        (pen.calculative.animateLineWidth || len) * store.data.scale;
      ctx.setLineDash([0.1, pen.length]);
      break;
    default:
      if (pen.animateReverse) {
        ctx.setLineDash([
          0,
          pen.length - pen.calculative.animatePos + 1,
          pen.calculative.animatePos,
        ]);
      } else {
        ctx.setLineDash([
          pen.calculative.animatePos,
          pen.length - pen.calculative.animatePos,
        ]);
      }
      break;
  }
}

/**
 * 全局 color
 */
export function getGlobalColor(store: Meta2dStore) {
  const { data, options } = store;
  return data.color || options.color;
}

export function renderLineAnchors(ctx: CanvasRenderingContext2D, pen: Pen) {
  const store = pen.calculative.canvas.store;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.fillStyle = pen.activeColor || store.options.activeColor;
  pen.calculative.worldAnchors.forEach((pt) => {
    !pt.hidden && !pt.isTemp && renderAnchor(ctx, pt, pen);
  });
  ctx.restore();
}

export function renderAnchor(
  ctx: CanvasRenderingContext2D,
  pt: Point,
  pen: Pen
) {
  if (!pt) {
    return;
  }

  const active =
    pen.calculative.canvas.store.activeAnchor ===
      pen.calculative.activeAnchor && pen.calculative.activeAnchor === pt;
  let r = 3;
  if (pen.calculative.lineWidth > 3) {
    r = pen.calculative.lineWidth;
  }
  if (pen.anchorRadius) {
    r = pen.anchorRadius;
  }
  if (pt.radius) {
    r = pt.radius;
  }
  if (active) {
    if (pt.prev) {
      ctx.save();
      ctx.strokeStyle = '#4dffff';
      ctx.beginPath();
      ctx.moveTo(pt.prev.x, pt.prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.prev.x, pt.prev.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (pt.next) {
      ctx.save();
      ctx.strokeStyle = '#4dffff';
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.next.x, pt.next.y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.next.x, pt.next.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function calcWorldRects(pen: Pen) {
  const store: Meta2dStore = pen.calculative.canvas.store;

  let rect: Rect = {
    x: pen.x,
    y: pen.y,
  };

  if (!pen.parentId) {
    rect.width = pen.width;
    rect.height = pen.height;
    rect.rotate = pen.rotate;
    calcRightBottom(rect);
    calcCenter(rect);
  } else {
    const parent = store.pens[pen.parentId];
    let parentRect = parent.calculative.worldRect;
    if (!parentRect) {
      parentRect = calcWorldRects(parent);
    }

    rect.x = parentRect.x + parentRect.width * pen.x;
    rect.y = parentRect.y + parentRect.height * pen.y;
    rect.width = parentRect.width * pen.width;
    rect.height = parentRect.height * pen.height;
    if (parent.flipX) {
      rect.x =
        parentRect.width - (rect.x - parentRect.x + rect.width) + parentRect.x;
    }
    if (parent.flipY) {
      rect.y =
        parentRect.height -
        (rect.y - parentRect.y + rect.height) +
        parentRect.y;
    }

    calcRightBottom(rect);

    rect.rotate = parentRect.rotate + pen.rotate;
    calcCenter(rect);
  }

  pen.calculative.worldRect = rect;
  // 这里的 rect 均是绝对值
  calcPadding(pen, rect);

  return rect;
}

export function calcPadding(pen: Pen, rect: Rect) {
  !pen.paddingTop && (pen.calculative.paddingTop = 0);
  !pen.paddingBottom && (pen.calculative.paddingBottom = 0);
  !pen.paddingLeft && (pen.calculative.paddingLeft = 0);
  !pen.paddingRight && (pen.calculative.paddingRight = 0);

  pen.calculative.paddingTop < 1 && (pen.calculative.paddingTop *= rect.height);
  pen.calculative.paddingBottom < 1 &&
    (pen.calculative.paddingBottom *= rect.height);
  pen.calculative.paddingLeft < 1 &&
    (pen.calculative.paddingLeft *= rect.width);
  pen.calculative.paddingRight < 1 &&
    (pen.calculative.paddingRight *= rect.width);
}

export function calcPenRect(pen: Pen) {
  const worldRect = pen.calculative.worldRect;
  if (!pen.parentId) {
    Object.assign(pen, worldRect);
    return;
  }
  const store = pen.calculative.canvas.store;
  const parentRect = store.pens[pen.parentId].calculative.worldRect;
  Object.assign(pen, calcRelativeRect(worldRect, parentRect));
}

export function calcWorldAnchors(pen: Pen) {
  const store: Meta2dStore = pen.calculative.canvas.store;
  let anchors: Point[] = [];
  if (pen.anchors) {
    let _anchors = deepClone(pen.anchors);
    if (pen.flipX) {
      _anchors.forEach((anchor) => {
        anchor.x = 0.5 - (anchor.x - 0.5);
      });
    }
    if (pen.flipY) {
      _anchors.forEach((anchor) => {
        anchor.y = 0.5 - (anchor.y - 0.5);
      });
    }
    _anchors.forEach((anchor) => {
      anchors.push(calcWorldPointOfPen(pen, anchor));
    });
  }

  // Default anchors of node
  if (
    !anchors.length &&
    !pen.type &&
    !pen.calculative.canvas.parent.isCombine(pen)
  ) {
    const { x, y, width, height } = pen.calculative.worldRect;
    anchors = store.options.defaultAnchors.map((anchor, index) => {
      return {
        id: `${index}`,
        penId: pen.id,
        x: x + width * anchor.x,
        y: y + height * anchor.y,
      };
    });
  }

  if (pen.calculative.rotate) {
    anchors.forEach((anchor) => {
      rotatePoint(
        anchor,
        pen.calculative.rotate,
        pen.calculative.worldRect.center
      );
    });
  }

  if (!pen.type || pen.anchors) {
    pen.calculative.worldAnchors = anchors;
  }

  if (pen.calculative.activeAnchor && anchors.length) {
    pen.calculative.activeAnchor = anchors.find((a) => {
      a.id === pen.calculative.activeAnchor.id;
    });
  }

  pen.calculative.gradientAnimatePath = undefined;
}

export function calcWorldPointOfPen(pen: Pen, pt: Point) {
  const p: Point = { ...pt };
  const { x, y, width, height } = pen.calculative.worldRect;
  p.x = x + width * pt.x;
  p.y = y + height * pt.y;
  if (pt.prev) {
    p.prev = {
      penId: pen.id,
      connectTo: pt.prev.connectTo,
      x: x + width * pt.prev.x,
      y: y + height * pt.prev.y,
    };
  }
  if (pt.next) {
    p.next = {
      penId: pen.id,
      connectTo: pt.next.connectTo,
      x: x + width * pt.next.x,
      y: y + height * pt.next.y,
    };
  }

  return p;
}

export function calcIconRect(pens: { [key: string]: Pen }, pen: Pen) {
  const { paddingTop, paddingBottom, paddingLeft, paddingRight } =
    pen.calculative;
  let x = paddingLeft;
  let y = paddingTop;
  let width = pen.calculative.worldRect.width - paddingLeft - paddingRight;
  let height = pen.calculative.worldRect.height - paddingTop - paddingBottom;
  let iconLeft = pen.calculative.iconLeft;
  let iconTop = pen.calculative.iconTop;
  if (iconLeft && Math.abs(iconLeft) < 1) {
    iconLeft = pen.calculative.worldRect.width * iconLeft;
  }

  if (iconTop && Math.abs(iconTop) < 1) {
    iconTop = pen.calculative.worldRect.height * iconTop;
  }
  x += iconLeft || 0;
  y += iconTop || 0;
  width -= iconLeft || 0;
  height -= iconTop || 0;

  let rotate = pen.calculative.iconRotate || 0;
  if (pen.parentId) {
    const parentPen = pens[pen.parentId].calculative;
    if (parentPen) {
      rotate += parentPen.rotate;
      rotate %= 360;
    }
  }

  x = pen.calculative.worldRect.x + x;
  y = pen.calculative.worldRect.y + y;
  pen.calculative.worldIconRect = {
    x,
    y,
    width,
    height,
    rotate,
  };
  calcRightBottom(pen.calculative.worldIconRect);
  calcCenter(pen.calculative.worldIconRect);
}

export function scalePen(pen: Pen, scale: number, center: Point) {
  scaleRect(pen.calculative.worldRect, scale, center);

  if (pen.calculative.initRect) {
    scaleRect(pen.calculative.initRect, scale, center);
  }
  if (pen.calculative.x) {
    scalePoint(pen.calculative as any as Point, scale, center);
  }

  if (pen.type) {
    calcWorldAnchors(pen);
  }
}

export function pushPenAnchor(pen: Pen, pt: Point) {
  if (!pen.anchors) {
    pen.anchors = [];
  }
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  const worldAnchor = {
    id: pt.id,
    penId: pen.id,
    x: pt.x,
    y: pt.y,
  };
  pen.calculative.worldAnchors.push(worldAnchor);

  if (pen.calculative.worldRect) {
    if (pen.rotate % 360) {
      rotatePoint(pt, -pen.rotate, pen.calculative.worldRect.center);
    }

    const anchor = {
      id: pt.id,
      penId: pen.id,
      x: (pt.x - pen.calculative.worldRect.x) / pen.calculative.worldRect.width,
      y:
        (pt.y - pen.calculative.worldRect.y) / pen.calculative.worldRect.height,
    };
    pen.anchors.push(anchor);
  }

  return worldAnchor;
}

export function addLineAnchor(pen: Pen, pt: Point, index: number) {
  if (!pen.anchors) {
    pen.anchors = [];
  }
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  const worldAnchor = getSplitAnchor(pen, pt, index);
  pen.calculative.worldAnchors.splice(index + 1, 0, worldAnchor);
  pen.anchors.splice(
    index + 1,
    0,
    calcRelativePoint(worldAnchor, pen.calculative.worldRect)
  );
  pen.calculative.activeAnchor = worldAnchor;
  return worldAnchor;
}

export function removePenAnchor(pen: Pen, anchor: Point) {
  if (!pen || !pen.calculative.worldAnchors) {
    return;
  }
  let i = pen.calculative.worldAnchors.findIndex((a) => a.id === anchor.id);
  if (i > -1) {
    pen.calculative.worldAnchors.splice(i, 1);
  }

  i = pen.anchors.findIndex((a) => a.id === anchor.id);
  if (i > -1) {
    pen.anchors.splice(i, 1);
  }
}

export function facePen(pt: Point, pen?: Pen) {
  if (!pen || !pen.calculative || !pen.calculative.worldRect.center) {
    return Direction.None;
  }
  if (pt.anchorId) {
    let anchor = pen.anchors.filter((_anchor) => _anchor.id === pt.anchorId);
    if (anchor.length) {
      if (anchor[0].direction > -1) {
        return anchor[0].direction;
      }
    }
  }
  return facePoint(pt, pen.calculative.worldRect.center);
}

export function nearestAnchor(pen: Pen, pt: Point) {
  let dis = Infinity;
  let anchor: Point;
  pen.calculative.worldAnchors.forEach((a: Point) => {
    const d = distance(pt, a);
    if (dis > d) {
      dis = d;
      anchor = a;
    }
  });

  return anchor;
}

export function translateLine(pen: Pen, x: number, y: number) {
  pen.x += x;
  pen.y += y;

  if (pen.anchors) {
    pen.anchors.forEach((a) => {
      translatePoint(a, x, y);
    });
  }

  if (pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors.forEach((a) => {
      translatePoint(a, x, y);
    });
  }
}

export function deleteTempAnchor(pen: Pen) {
  if (pen && pen.calculative && pen.calculative.worldAnchors.length) {
    let to: Point = getToAnchor(pen);

    // 第一次画线
    if (!pen.anchors || !pen.anchors.length) {
      while (
        pen.calculative.worldAnchors.length &&
        to !== pen.calculative.activeAnchor
      ) {
        pen.calculative.worldAnchors.pop();
        to = getToAnchor(pen);
      }
    }
    // 拖拽终点
    else if (to === pen.calculative.activeAnchor) {
      pen.calculative.worldAnchors = [pen.calculative.worldAnchors[0]];
    }
    // 拖拽起点
    else if (pen.calculative.worldAnchors[0] === pen.calculative.activeAnchor) {
      pen.calculative.worldAnchors = [
        pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 1],
      ];
    }
  }
}

/**
 * 添加line到pen的connectedLines中，并关联相关属性
 * 不添加连线到画布中，请确保画布中已经有该连线。
 * */
export function connectLine(
  pen: Pen,
  anchor: Point,
  line: Pen,
  lineAnchor: Point
) {
  if (
    !pen ||
    !anchor ||
    !line ||
    !lineAnchor ||
    anchor.twoWay === TwoWay.DisableConnected ||
    anchor.twoWay === TwoWay.Disable ||
    lineAnchor.twoWay === TwoWay.DisableConnectTo ||
    lineAnchor.twoWay === TwoWay.Disable
  ) {
    return;
  }

  if (anchor.twoWay === TwoWay.In) {
    if (line.calculative.worldAnchors.length === 1) {
      return;
    }
    const to = getToAnchor(line);
    if (lineAnchor.id !== to.id) {
      return;
    }
  }

  if (anchor.twoWay === TwoWay.Out) {
    const from = getFromAnchor(line);
    if (lineAnchor.id !== from.id) {
      return;
    }
  }

  if (lineAnchor.connectTo === pen.id && lineAnchor.anchorId === anchor.id) {
    return;
  }

  if (lineAnchor.connectTo) {
    const p = pen.calculative.canvas.store.pens[lineAnchor.connectTo];
    disconnectLine(p, getAnchor(p, lineAnchor.anchorId), line, lineAnchor);
  }

  if (!pen.connectedLines) {
    pen.connectedLines = [];
  }

  const i = pen.connectedLines.findIndex(
    (item) =>
      item.lineId === line.id &&
      item.lineAnchor === lineAnchor.id &&
      item.anchor === anchor.id
  );

  if (i < 0) {
    pen.connectedLines.push({
      lineId: line.id,
      lineAnchor: lineAnchor.id,
      anchor: anchor.id,
    });
  }

  lineAnchor.connectTo = pen.id;
  lineAnchor.anchorId = anchor.id;

  // 如果两条连线，则相互关联
  if (pen.type) {
    connectLine(line, lineAnchor, pen, anchor);
  }

  pen.calculative.canvas.store.emitter.emit('connectLine', {
    line,
    lineAnchor,
    pen,
    anchor,
  });

  return true;
}

/**
 * 从 pen.connectedLines 中删除 lineId 和 lineAnchor
 */
export function disconnectLine(
  pen: Pen,
  anchor: Point,
  line: Pen,
  lineAnchor: Point
) {
  if (!pen || !anchor || !line || !lineAnchor) {
    return;
  }

  if (!pen.connectedLines || !pen.connectedLines.length) {
    return;
  }

  pen.connectedLines.forEach((item, index, arr) => {
    if (
      (item.lineId === line.id || item.lineId === line.id) &&
      item.lineAnchor === lineAnchor.id &&
      item.anchor === anchor.id
    ) {
      arr.splice(index, 1);
    }
  });

  lineAnchor.connectTo = undefined;
  lineAnchor.anchorId = undefined;
  // 如果两条连线相互关联，则都取消关联
  if (
    pen.type &&
    anchor.connectTo === line.id &&
    anchor.anchorId === lineAnchor.id
  ) {
    disconnectLine(line, lineAnchor, pen, anchor);
  }

  pen.calculative.canvas.store.emitter.emit('disconnectLine', {
    line,
    lineAnchor,
    pen,
    anchor,
  });

  return true;
}

export function getAnchor(pen: Pen, anchorId: string) {
  if (!pen || !anchorId) {
    return;
  }

  return pen.calculative.worldAnchors?.find((item) => item.id === anchorId);
}

export function getFromAnchor(pen: Pen) {
  if (!pen || !pen.calculative.worldAnchors) {
    return;
  }

  return pen.calculative.worldAnchors[0];
}

export function getToAnchor(pen: Pen) {
  if (!pen || !pen.calculative.worldAnchors) {
    return;
  }

  return pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 1];
}

export function setNodeAnimate(pen: Pen, now: number) {
  if (pen.calculative.start === 0 || !pen.frames || !pen.frames.length) {
    pen.calculative.start = undefined;
    return 0;
  }
  if (!pen.calculative.duration) {
    pen.calculative.duration = 0;
    for (const f of pen.frames) {
      pen.calculative.duration += f.duration;
      for (const k in f) {
        if (k !== 'duration' && !pen[k]) {
          if (k === 'scale') {
            pen[k] = 1;
          }
        }
      }
    }
  }
  if (!pen.animateCycle) {
    pen.animateCycle = Infinity;
  }

  if (!pen.calculative.start) {
    pen.calculative.start = now;
    pen.calculative.frameIndex = 0;
    pen.calculative.frameStart = pen.calculative.start;
    pen.calculative.frameDuration = pen.frames[0].duration;
    pen.calculative.frameEnd =
      pen.calculative.frameStart + pen.calculative.frameDuration;
    pen.calculative.cycleIndex = 1;
    pen.calculative.x = pen.calculative.worldRect.x;
    pen.calculative.y = pen.calculative.worldRect.y;
    pen.calculative.initRect = deepClone(pen.calculative.worldRect);
    pen.calculative.initRect.rotate = pen.calculative.rotate || 0;

    initPrevFrame(pen);
  } else {
    let frameIndex = 0;
    const cycleIndex = Math.ceil(
      (now - pen.calculative.start) / pen.calculative.duration
    );
    // 播放结束
    if (cycleIndex > pen.animateCycle) {
      pen.currentAnimation = undefined;
      pen.calculative.start = undefined;
      setNodeAnimateProcess(pen, 1);
      return 0;
    }

    const pos = (now - pen.calculative.start) % pen.calculative.duration;
    let d = 0;
    for (const frame of pen.frames) {
      d += frame.duration;
      if (pos > d) {
        ++frameIndex;
      } else {
        break;
      }
    }
    // 帧超出
    if (!pen.frames[frameIndex]) {
      return true;
    }

    pen.calculative.frameDuration = pen.frames[frameIndex].duration;
    pen.calculative.frameStart =
      pen.calculative.start + pen.calculative.duration * (cycleIndex - 1);
    pen.calculative.frameEnd =
      pen.calculative.frameStart + pen.calculative.frameDuration;

    // 换帧
    const frameChanged = frameIndex !== pen.calculative.frameIndex;
    // 新循环播放
    const cycleChanged = cycleIndex > pen.calculative.cycleIndex;

    frameChanged && (pen.calculative.frameIndex = frameIndex);
    cycleChanged && (pen.calculative.cycleIndex = cycleIndex);

    if (frameChanged || cycleChanged) {
      // 以初始位置为参考点。因为网页在后台时，不执行动画帧，网页恢复显示时，位置不确定
      pen.calculative.x = pen.calculative.initRect.x;
      pen.calculative.y = pen.calculative.initRect.y;
      pen.calculative.rotate = pen.calculative.initRect.rotate || 0;

      if (frameIndex > 0) {
        pen.prevFrame = {};
        const prevFrame = pen.frames[frameIndex - 1];
        for (const k in prevFrame) {
          pen.prevFrame[k] = prevFrame[k];
        }
        Object.assign(pen.prevFrame, {
          rotate: prevFrame.rotate || 0,
          x: prevFrame.x || 0,
          y: prevFrame.y || 0,
          scale: prevFrame.scale || 1,
        });
      } else {
        initPrevFrame(pen);
      }
    }
  }

  const process =
    ((now - pen.calculative.frameStart) / pen.calculative.frameDuration) % 1;
  setNodeAnimateProcess(pen, process);

  return true;
}

// 把前一个动画帧初始化为播放前状态
export function initPrevFrame(pen: Pen) {
  pen.prevFrame = {};
  for (const k in pen) {
    if (typeof pen[k] !== 'object' || k === 'lineDash') {
      pen.prevFrame[k] = pen[k];
    }
  }
  pen.prevFrame.rotate = 0;
  pen.prevFrame.x = 0;
  pen.prevFrame.y = 0;
  pen.prevFrame.scale = 1;
}

// 根据process进度值（纯小数），计算节点动画属性
export function setNodeAnimateProcess(pen: Pen, process: number) {
  if (process < 0) {
    return;
  }

  if (process > 1) {
    process = 1;
  }

  const frame = pen.frames[pen.calculative.frameIndex];
  for (const k in frame) {
    if (k === 'duration') {
      continue;
    } else if (k === 'scale') {
      pen.calculative.worldRect = deepClone(pen.calculative.initRect);
      scaleRect(
        pen.calculative.worldRect,
        pen.prevFrame.scale,
        pen.calculative.worldRect.center
      );
      const newScale =
        pen.prevFrame.scale + (frame[k] - pen.prevFrame.scale) * process;
      scaleRect(
        pen.calculative.worldRect,
        newScale / pen.prevFrame.scale,
        pen.calculative.worldRect.center
      );
      pen.calculative.patchFlags = true;
    } else if (k === 'x') {
      const lastVal = getFrameValue(pen, k, pen.calculative.frameIndex);
      pen.calculative.worldRect.x = pen.calculative.initRect.x + lastVal;
      pen.calculative.worldRect.ex = pen.calculative.initRect.ex + lastVal;
      translateRect(
        pen.calculative.worldRect,
        frame[k] * process * pen.calculative.canvas.store.data.scale,
        0
      );
      pen.calculative.patchFlags = true;
    } else if (k === 'y') {
      const lastVal = getFrameValue(pen, k, pen.calculative.frameIndex);
      pen.calculative.worldRect.y = pen.calculative.initRect.y + lastVal;
      pen.calculative.worldRect.ey = pen.calculative.initRect.ey + lastVal;
      translateRect(
        pen.calculative.worldRect,
        0,
        frame[k] * process * pen.calculative.canvas.store.data.scale
      );
      pen.calculative.patchFlags = true;
    } else if (k === 'rotate') {
      if (pen.prevFrame[k] >= 360) {
        pen.prevFrame[k] %= 360;
      }
      const lastVal = getFrameValue(pen, k, pen.calculative.frameIndex);
      const offsetRotate =
        ((pen.calculative.initRect.rotate + lastVal + frame[k] * process) %
          360) -
        pen.calculative.rotate;
      if (pen.children?.length) {
        pen.calculative.canvas.rotatePen(
          pen,
          offsetRotate,
          pen.calculative.initRect
        );
      } else {
        pen.calculative.rotate =
          (pen.calculative.initRect.rotate + lastVal + frame[k] * process) %
          360;
      }
      pen.calculative.patchFlags = true;
    } else if (k === 'image') {
      pen.image = frame['image'];
      pen.calculative.image = undefined;
      pen.calculative.canvas.loadImage(pen);
      if (pen.isBottom) {
        pen.calculative.canvas.canvasImageBottom.init();
      } else {
        pen.calculative.canvas.canvasImage.init();
      }
    } else if (isLinear(frame[k], k, pen)) {
      if (pen.prevFrame[k] == null) {
        if (k === 'globalAlpha') {
          pen.prevFrame[k] = 1;
        } else {
          pen.prevFrame[k] = 0;
        }
      }

      const current =
        pen.prevFrame[k] + (frame[k] - pen.prevFrame[k]) * process;
      pen.calculative[k] = Math.round(current * 100) / 100;
    } else {
      if (k === 'visible') {
        if (pen.calculative.image) {
          if (pen.isBottom) {
            pen.calculative.canvas.canvasImageBottom.init();
          } else {
            pen.calculative.canvas.canvasImage.init();
          }
        }
      }
      pen.calculative[k] = frame[k];
      const v: any = {};
      v[k] = frame[k];
      setChildValue(pen, v);
    }

    if (k === 'text') {
      calcTextLines(pen);
    }
  }
}

/**
 * 值类型为 number , pen.linear 为 false 时，且 key 不属于 noLinear 时，返回 true
 * @param value 值
 * @param key 键值
 * @param pen 画笔
 * @returns
 */
function isLinear(value: unknown, key: string, pen: Pen): boolean {
  // 不线性变化的属性
  const noLinear = ['strokeType', 'bkType', 'showChild'] as const;
  type NoLinear = (typeof noLinear)[number];
  return (
    typeof value === 'number' &&
    pen.linear !== false &&
    !noLinear.includes(key as NoLinear)
  );
}

export function setLineAnimate(pen: Pen, now: number) {
  if (pen.calculative.start === 0) {
    pen.calculative.start = undefined;
    return 0;
  }

  if (!pen.animateCycle) {
    pen.animateCycle = Infinity;
  }

  if (!pen.animateSpan) {
    pen.animateSpan = 1;
  }

  pen.calculative.animatePos +=
    pen.animateSpan * (pen.calculative.canvas.store.data.scale || 1);
  if (!pen.calculative.start) {
    pen.calculative.start = Date.now();
    pen.calculative.animatePos =
      pen.animateSpan * (pen.calculative.canvas.store.data.scale || 1);
    pen.calculative.cycleIndex = 1;
  } else if (pen.calculative.animatePos > pen.length) {
    // 播放到尾了
    ++pen.calculative.cycleIndex;

    // 播放结束
    if (pen.calculative.cycleIndex > pen.animateCycle) {
      pen.currentAnimation = undefined;
      pen.calculative.start = undefined;
      return 0;
    }
    pen.calculative.animatePos = pen.animateSpan;
  }

  return true;
}

export function setChildrenActive(pen: Pen, active = true) {
  if (!pen.children) {
    return;
  }
  const store = pen.calculative.canvas.store;
  pen.children.forEach((id) => {
    const child: Pen = store.pens[id];
    if (child) {
      child.calculative.active = active;

      setChildrenActive(child, active);
    }
  });
}

export function setHover(pen: Pen, hover = true) {
  if (!pen) {
    return;
  }
  const store = pen.calculative.canvas.store;
  pen.calculative.hover = hover;
  if (pen.children) {
    pen.children.forEach((id) => {
      // 子节点没有自己的独立hover，继承父节点hover
      if (
        store.pens[id]?.hoverColor == undefined &&
        store.pens[id]?.hoverBackground == undefined
      ) {
        setHover(store.pens[id], hover);
      }
    });
  }
}

export function setElemPosition(pen: Pen, elem: HTMLElement) {
  if (!elem) {
    return;
  }
  const store = pen.calculative.canvas.store;
  const worldRect = pen.calculative.worldRect;
  elem.style.opacity = pen.globalAlpha + '';
  elem.style.position = 'absolute';
  elem.style.outline = 'none';
  elem.style.left = worldRect.x + store.data.x + 'px';
  elem.style.top = worldRect.y + store.data.y + 'px';
  elem.style.width = worldRect.width + 'px';
  elem.style.height = worldRect.height + 'px';
  elem.style.display =
    pen.calculative.inView != false
      ? pen.calculative.cssDisplay || 'inline'
      : 'none'; // 是否隐藏元素
  !pen.calculative.rotate && (pen.calculative.rotate = 0);
  elem.style.transform = `rotate(${pen.calculative.rotate}deg)`;
  if (!pen.calculative.rotate) {
    if (pen.calculative.flipX) {
      elem.style.transform = `rotateY(180deg)`;
    }
    if (pen.calculative.flipY) {
      elem.style.transform = `rotateX(180deg)`;
    }
    if (pen.calculative.flipX && pen.calculative.flipY) {
      elem.style.transform = `rotateZ(180deg)`;
    }
  }
  elem.style.zIndex =
    pen.calculative.zIndex !== undefined ? pen.calculative.zIndex + '' : '4';
  if (pen.calculative.zIndex > pen.calculative.canvas.maxZindex) {
    pen.calculative.canvas.maxZindex = pen.calculative.zIndex;
  }
  if (
    pen.locked === LockState.DisableEdit ||
    pen.locked === LockState.DisableMove ||
    store.data.locked
  ) {
    // gif 组合后，作为子节点可通过 lockedOnCombine 来决定自身的 locked 状态
    elem.style.userSelect = 'initial';
    elem.style.pointerEvents = 'initial';
    if (pen.name === 'gif') {
      elem.style.userSelect = 'none';
      elem.style.pointerEvents = 'none';
    }
  } else {
    // pen.locked LockState.Disable 不响应鼠标
    elem.style.userSelect = 'none';
    elem.style.pointerEvents = 'none';
  }
}

export function setElemImg(pen: Pen, elem: HTMLElement) {
  if (!elem) {
    return;
  }
  //https://github.com/niklasvh/html2canvas
  globalThis.html2canvas &&
    globalThis.html2canvas(elem).then(function (canvas) {
      // document.body.appendChild(canvas);
      const img = new Image();
      img.src = canvas.toDataURL('image/png', 0.1);
      if (img.src.length > 10) {
        pen.calculative.img = img;
      }
    });
}

/**
 * 每个画笔 locked
 * @param pens 画笔
 * @returns
 */
export function getPensLock(pens: Pen[]): boolean {
  return pens.every((pen) => pen.locked);
}

/**
 * 画笔们的 disabledRotate = true
 * 即 全部禁止旋转 返回 true
 * @param pens 画笔
 * @returns
 */
export function getPensDisableRotate(pens: Pen[]): boolean {
  return pens.every((pen) => pen.disableRotate);
}

export function rotatePen(pen: Pen, angle: number, rect: Rect) {
  if (pen.type) {
    pen.calculative.worldAnchors.forEach((anchor) => {
      rotatePoint(anchor, angle, rect.center);
    });
    initLineRect(pen);
    calcPenRect(pen);
  } else {
    if (pen.calculative.rotate) {
      pen.calculative.rotate += angle;
    } else {
      pen.calculative.rotate = angle;
    }
    rotatePoint(pen.calculative.worldRect.center, angle, rect.center);
    if (pen.parentId) {
      pen.calculative.worldRect.x =
        pen.calculative.worldRect.center.x -
        pen.calculative.worldRect.width / 2;
      pen.calculative.worldRect.y =
        pen.calculative.worldRect.center.y -
        pen.calculative.worldRect.height / 2;
      pen.x = (pen.calculative.worldRect.x - rect.x) / rect.width;
      pen.y = (pen.calculative.worldRect.y - rect.y) / rect.height;
    }
  }

  pen.children?.forEach((id) => {
    const child = pen.calculative.canvas.store.pens[id];
    rotatePen(child, angle, rect);
  });
}

function initLineRect(pen: Pen) {
  if (!pen.calculative.worldAnchors?.length) {
    return;
  }
  if (!isFinite(pen.x) || !isFinite(pen.x)) {
    return;
  }
  if (pen.x == null || pen.y == null) {
    return;
  }
  const rect = getLineRect(pen);
  if (!pen.parentId) {
    Object.assign(pen, rect);
  }
  const { fontSize, lineHeight } = pen.calculative.canvas.store.options;
  if (!pen.fontSize) {
    pen.fontSize = fontSize;
    pen.calculative.fontSize =
      pen.fontSize * pen.calculative.canvas.store.data.scale;
  }
  if (!pen.lineHeight) {
    pen.lineHeight = lineHeight;
    pen.calculative.lineHeight = pen.lineHeight;
  }
  calcCenter(rect);
  pen.calculative.worldRect = rect;
  calcPadding(pen, rect);
  calcTextRect(pen);
  if (pen.calculative.worldAnchors) {
    pen.anchors = pen.calculative.worldAnchors.map((pt) => {
      return calcRelativePoint(pt, pen.calculative.worldRect);
    });
  }
}

/**
 * 画笔们的 disableSize = true
 * 即 全部不允许改变大小 返回 true
 * @param pens 画笔
 * @returns
 */
export function getPensDisableResize(pens: Pen[]): boolean {
  return pens.every((pen) => pen.disableSize);
}

export function getFrameValue(pen: Pen, prop: string, frameIndex: number) {
  if (!pen.frames || !prop) {
    return 0;
  }

  let v = 0;
  for (let i = 0; i < frameIndex; i++) {
    if (pen.frames[i]) {
      v += pen.frames[i][prop] || 0;
    }
  }

  return v;
}

/**
 * 判断该画笔 是否是组合为状态中 展示的画笔
 */
export function isShowChild(pen: Pen, store: Meta2dStore) {
  let selfPen = pen;
  while (selfPen && selfPen.parentId) {
    const oldPen = selfPen;
    selfPen = store.pens[selfPen.parentId];
    const showChildIndex = selfPen?.calculative?.showChild;
    if (showChildIndex != undefined) {
      const showChildId = selfPen.children[showChildIndex];
      if (showChildId !== oldPen.id) {
        // toPng 不展示它
        return false;
      }
    }
  }
  return true;
}

/**
 * 计算画笔的 inView
 * @param pen 画笔
 * @param calcChild 是否计算子画笔
 */
export function calcInView(pen: Pen, calcChild = false) {
  const { store, canvasRect } = pen.calculative.canvas as Canvas;
  if (calcChild) {
    pen.children?.forEach((id) => {
      const child = store.pens[id];
      child && calcInView(child, true);
    });
  }

  pen.calculative.inView = true;
  if (
    !isShowChild(pen, store) ||
    pen.visible == false ||
    pen.calculative.visible == false
  ) {
    pen.calculative.inView = false;
  } else {
    const { x, y, width, height, rotate } = pen.calculative.worldRect;
    const penRect: Rect = {
      x: x + store.data.x,
      y: y + store.data.y,
      width,
      height,
      rotate,
    };
    calcRightBottom(penRect);
    if (!rectInRect(penRect, canvasRect)) {
      pen.calculative.inView = false;
    }
  }
  // TODO: 语义化上，用 onValue 更合适，但 onValue 会触发 echarts 图形的重绘，没有必要
  // 更改 view 后，修改 dom 节点的显示隐藏
  pen.onMove?.(pen);
}

/**
 * 绘制 rect ，上线后可查看 rect 位置
 */
function inspectRect(
  ctx: CanvasRenderingContext2D,
  store: Meta2dStore,
  pen: Pen
) {
  if (store.fillWorldTextRect) {
    ctx.save();
    ctx.fillStyle = '#c3deb7';
    const { x, y, width, height } = pen.calculative.worldTextRect;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }
}

export function setGlobalAlpha(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen
) {
  const globalAlpha = pen.calculative.globalAlpha;
  if (globalAlpha < 1) {
    ctx.globalAlpha = globalAlpha;
  }
}

/**
 * ctx 绘制图纸，并非 Path2D
 * @param ctx 画布上下文
 * @param pen 画笔
 */
function ctxDrawCanvas(ctx: CanvasRenderingContext2D, pen: Pen) {
  const canvasDraw = globalStore.canvasDraws[pen.name];
  if (canvasDraw) {
    // TODO: 后续考虑优化 save / restore
    ctx.save();
    // TODO: 原有 return 终止后续操作，必要性不大
    canvasDraw(ctx, pen);
    ctx.restore();
  }
}

export function setChildValue(pen: Pen, data: IValue) {
  for (const k in data) {
    if (inheritanceProps.includes(k)) {
      pen[k] = data[k];
      pen.calculative[k] = data[k];
    }
  }
  if (
    pen.calculative.canvas.parent.isCombine(pen) &&
    pen.showChild === undefined
  ) {
    const children = pen.children;
    children?.forEach((childId) => {
      const child = pen.calculative.canvas.store.pens[childId];
      setChildValue(child, data);
    });
  }
}
