import { deepClone, getRectOfPoints, Pen, Rect, s8 } from '@meta2d/core';
import { getRect, parseSvgPath } from './parse';
import { XMLParser } from 'fast-xml-parser/src/fxp';

const selfName = ':@';
const contentProp = '#text';

let allRect: Rect;
let shapeScale: number; // 图形缩小比例
let anchorsArr = [];
const gradientMap = {};
let style = undefined;
let linearGradient: Gradient[] = [];

interface Gradient {
  id: string; // 当前的 id 值
  from: string; // 该渐变来自于哪个渐变 即 xlink:href 属性， 比 id 多一个 #
  color: string; // 颜色，from 存在时，该值应该不存在
}

/**
 * 解析SVG字符串为Meta2d图元数组
 * @param svg SVG字符串
 * @returns 图元数组，第一个为组合图元，后续为子图元
 */
export function parseSvg(svg: string): Pen[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    preserveOrder: true,
  });

  const xmlJson: any[] = parser.parse(svg);
  const svgs = xmlJson.filter((item) => item.svg);
  const pens: Pen[] = [];
  anchorsArr = [];
  linearGradient = [];

  svgs.forEach((svg) => {
    const selfProperty = svg[selfName];
    allRect = transformContainerRect(selfProperty);

    if (selfProperty.width && selfProperty.width.includes('%')) {
      selfProperty.width = (allRect.width * parseFloat(selfProperty.width)) / 100;
    }
    if (selfProperty.height && selfProperty.height.includes('%')) {
      selfProperty.height = (allRect.height * parseFloat(selfProperty.height)) / 100;
    }

    const isWidthLitter = allRect.width < allRect.height; // 宽小于高
    // 长边等于 40
    if (!isWidthLitter) {
      if (!selfProperty.width) {
        selfProperty.width = 40;
      }
      shapeScale = selfProperty.width / allRect.width;
      !selfProperty.height && (selfProperty.height = shapeScale * allRect.height);
    } else {
      // 高小于宽
      if (!selfProperty.height) {
        selfProperty.height = 40;
      }
      shapeScale = selfProperty.height / allRect.height;
      !selfProperty.width && (selfProperty.width = shapeScale * allRect.width);
    }
    if (isNaN(shapeScale)) {
      shapeScale = 1;
    }

    const children: any[] = svg.svg;

    // 全局样式
    const globalStyle = children.filter((item) => item.defs);
    globalStyle.forEach((item) => {
      setGradient(item.defs.filter((def) => def.linearGradient));
    });

    const combinePens: Pen[] = transformCombines(selfProperty, children);
    pens.push(...combinePens);
  });

  if (pens.length > 0) {
    // group 图元现在在数组最后，给它设置锚点
    const lastPen = pens[pens.length - 1];
    if (lastPen.type === 'group') {
      setAnchor(lastPen);
      // 确保所有子图元都解锁
      pens.forEach((pen) => {
        if (pen.parentId === lastPen.id) {
          pen.locked = false;
        }
      });
    }
  }

  return pens;
}

/**
 * 设置锚点到第一个图元（组合图元）
 */
function setAnchor(pen: Pen) {
  anchorsArr = anchorsArr.map((item, index) => {
    return {
      id: index + '',
      host: pen.id,
      x: item.x,
      y: item.y,
    };
  });
  pen.anchors = anchorsArr;
}

/**
 * 转换组合图元及其子图元
 * 注意：2.0版本中子图元使用绝对坐标（像素值），而非相对坐标
 */
function transformCombines(selfProperty, children: any[]): Pen[] {
  const pens: Pen[] = [];
  const [width, height] = dealUnit(selfProperty);

  if (selfProperty.visibility === 'hidden') {
    selfProperty.visible = false;
  }

  // 创建组合图元 - 2.0版本使用type: 'group'
  const combinePen: Pen = {
    id: s8(),
    type: 'group', // 1.0的name:'combine' → 2.0的type:'group'
    x: selfProperty.x || 0,
    y: selfProperty.y || 0,
    locked: selfProperty.locked,
    width,
    height,
    children: [],
    visible: selfProperty.visible !== false,
  };

  children.forEach((child) => {
    let pen: Pen | Pen[] = undefined;
    const childProperty = child[selfName];

    if (childProperty && childProperty.transform) {
      child.g &&
        child.g.forEach((item) => {
          if (!item[selfName]) {
            item[selfName] = {
              transform: childProperty.transform,
            };
          } else {
            item[selfName].transform = childProperty.transform;
          }
        });
    }

    if (child.g) {
      // g 类型 - 嵌套组合
      pen = transformCombines(
        {
          x: 0,
          y: 0,
          width: allRect.width,
          height: allRect.height,
          locked: 10, // 内层的 combine locked 10
          ...childProperty,
        },
        child.g,
      );
    } else if (child.svg) {
      // 嵌套svg
      let x = 0,
        y = 0,
        width = allRect.width,
        height = allRect.height;

      if (childProperty.transform) {
        const xy = getTranslateXY(childProperty.transform);
        if (xy) {
          x = xy.x;
          y = xy.y;
        }
      }

      const viewbox_Rect = transformContainerRect(childProperty);
      width = Number(childProperty.width) || viewbox_Rect.width;
      height = Number(childProperty.height) || viewbox_Rect.height;

      let tem = deepClone(allRect);
      allRect.width = viewbox_Rect.width;
      allRect.height = viewbox_Rect.height;

      pen = transformCombines(
        {
          x,
          y,
          width,
          height,
          locked: 10,
        },
        child.svg,
      );

      allRect = tem;
    } else if (child.a) {
      // a 类型
      pen = transformCombines(
        {
          x: 0,
          y: 0,
          width: allRect.width,
          height: allRect.height,
          locked: 10,
          ...childProperty,
        },
        child.a,
      );
    } else if (child.defs) {
      setStyle(child.defs.filter((item) => item.style));
      setLinearGradient(child.defs.filter((item) => item.linearGradient));
      setGradient(child.defs.filter((item) => item.linearGradient));
    } else if (child.style) {
      setStyle([{ style: child.style }]);
    } else if (childProperty) {
      pen = transformNormalShape(childProperty, selfProperty, combinePen.id);

      if (child.path) {
        pen = transformPath(childProperty, pen);
      } else if (child.rect) {
        pen = transformRect(childProperty, pen);
        collectAnchors(pen);
      } else if (child.circle) {
        pen = transformCircle(childProperty, pen);
        collectAnchors(pen);
      } else if (child.ellipse) {
        pen = transformCircle(childProperty, pen);
      } else if (child.line) {
        pen = transformLine(childProperty, pen);
        collectLineAnchors(pen);
      } else if (child.polygon) {
        pen = transformPolygon(childProperty, pen);
      } else if (child.polyline) {
        pen = transformPolyline(childProperty, pen);
        collectPolylineAnchors(pen);
      } else if (child.text) {
        pen = transformText(childProperty, child.text, pen);
      } else if (child.image) {
        pen = transformImage(childProperty, pen);
      } else {
        pen = undefined;
      }
    }

    if (pen) {
      if (Array.isArray(pen)) {
        for (const iPen of pen) {
          if (!iPen.parentId) {
            iPen.parentId = combinePen.id;
            combinePen.children.push(iPen.id);
          }
        }
        pens.push(...pen);
      } else {
        combinePen.children.push(pen.id);
        pens.push(pen);
      }
    }
  });

  // group 图元放在数组最后
  pens.push(combinePen);

  return pens;
}

/**
 * 收集矩形/圆形的锚点（边界锚点）
 */
function collectAnchors(pen: any) {
  const circleAnchors = [
    { x: pen.x + pen.width * 0.5, y: pen.y },
    { x: pen.x + pen.width, y: pen.y + pen.height * 0.5 },
    { x: pen.x + pen.width * 0.5, y: pen.y + pen.height },
    { x: pen.x, y: pen.y + pen.height * 0.5 },
  ];

  circleAnchors.forEach((item) => {
    // 只收集边界上的锚点
    if (
      item.x <= allRect.x + 1 ||
      item.x >= allRect.x + allRect.width - 1 ||
      item.y <= allRect.y + 1 ||
      item.y >= allRect.y + allRect.height - 1
    ) {
      anchorsArr.push({ x: item.x, y: item.y, id: s8() });
    }
  });
}

/**
 * 收集连线锚点
 */
function collectLineAnchors(pen: any) {
  pen.anchors?.forEach((anchor) => {
    const x = pen.x + anchor.x * pen.width;
    const y = pen.y + anchor.y * pen.height;

    if (
      x <= allRect.x + 1 ||
      x >= allRect.x + allRect.width - 1 ||
      y <= allRect.y + 1 ||
      y >= allRect.y + allRect.height - 1
    ) {
      anchorsArr.push({ x, y, id: s8() });
    }
  });
}

/**
 * 收集折线锚点
 */
function collectPolylineAnchors(pen: any) {
  pen.anchors?.forEach((anchor) => {
    const x = pen.x + anchor.x * pen.width;
    const y = pen.y + anchor.y * pen.height;

    if (
      x <= allRect.x + 1 ||
      x >= allRect.x + allRect.width - 1 ||
      y <= allRect.y + 1 ||
      y >= allRect.y + allRect.height - 1
    ) {
      anchorsArr.push({ x, y, id: s8() });
    }
  });
}

/**
 * 获取translate变换的偏移量
 */
function getTranslate(transform: string) {
  let offsetX = 0;
  let offsetY = 0;

  if (transform && transform.includes('translate')) {
    let matchArr = transform.replace('translate(', '').replace(')', '').split(',');
    offsetX = parseFloat(matchArr[0]);
    offsetY = parseFloat(matchArr[1]);
  }

  return { offsetX, offsetY };
}

/**
 * 提取translate(x,y)中的x,y值
 */
function getTranslateXY(str: string) {
  const regex = /translate\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/;
  const match = str.match(regex);

  if (match) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    return { x, y };
  }
  return null;
}

/**
 * 转换path图元
 */
function transformPath(path: any, pen: any): any {
  let d = path.d;
  if (!d) {
    return;
  }

  let commands = parseSvgPath(d);
  let rect = getRect(commands);
  let offsetX = 0;
  let offsetY = 0;

  if (path.transform && path.transform.includes('translate')) {
    let trans = getTranslate(path.transform);
    offsetX = trans.offsetX;
    offsetY = trans.offsetY;
  } else if (path.transform && path.transform.includes('rotate')) {
    const match = path.transform.match(/(-?\d+\.?\d*)/g);
    if (match?.length >= 3) {
      if (!pen.pivot) {
        pen.pivot = {};
      }
      pen.pivot.x = (parseFloat(match[1]) - rect.x) / rect.width;
      pen.pivot.y = (parseFloat(match[2]) - rect.y) / rect.height;
    }
  }

  rect.x += offsetX;
  rect.ex += offsetX;
  rect.y += offsetY;
  rect.ey += offsetY;

  // 2.0使用绝对坐标
  const x = rect.x + pen.x - allRect.x;
  const y = rect.y + pen.y - allRect.y;
  const width = rect.width;
  const height = rect.height;

  const pathPen = {
    ...pen,
    type: 'svgPath', // 1.0的name:'svgPath' → 2.0的type:'svgPath'
    path: d,
    x,
    y,
    width,
    height,
    disableAnchor: true,
  };

  return pathPen;
}

/**
 * 转换矩形图元
 */
function transformRect(rect: any, pen: any): any {
  // 2.0使用绝对坐标
  const x = (rect.x || 0) - allRect.x + pen.x;
  const y = (rect.y || 0) - allRect.y + pen.y;
  const width = parseFloat(rect.width) || 0;
  const height = parseFloat(rect.height) || 0;
  const borderRadius = rect.rx || rect.ry || 0;

  const rectPen = {
    ...pen,
    type: 'rectangle', // 1.0的name:'rectangle' → 2.0的type:'rectangle'
    x,
    y,
    width,
    height,
    borderRadius: parseFloat(borderRadius),
  };

  return rectPen;
}

/**
 * 转换圆形或椭圆图元
 */
function transformCircle(circle: any, pen: any): any {
  const rx = circle.rx || circle.r;
  const ry = circle.ry || circle.r;

  // 2.0使用绝对坐标
  const x = parseFloat(circle.cx) - parseFloat(rx) - allRect.x + pen.x;
  const y = parseFloat(circle.cy) - parseFloat(ry) - allRect.y + pen.y;
  const width = 2 * parseFloat(rx);
  const height = 2 * parseFloat(ry);

  return {
    ...pen,
    type: 'circle', // 1.0的name:'circle' → 2.0的type:'circle'
    x,
    y,
    width,
    height,
  };
}

/**
 * 解析容器的viewBox或width/height
 */
function transformContainerRect(mySelf: any): Rect {
  if (mySelf.viewBox) {
    const viewBox = mySelf.viewBox.split(' ');
    return {
      x: Number(viewBox[0]),
      y: Number(viewBox[1]),
      width: Number(viewBox[2]),
      height: Number(viewBox[3]),
    };
  } else {
    return {
      x: 0,
      y: 0,
      width: parseFloat(mySelf.width) || 0,
      height: parseFloat(mySelf.height) || 0,
    };
  }
}

/**
 * 转换通用图形属性
 */
function transformNormalShape(childProperty: any, parentProperty, parentId: string): any {
  // style > class > self
  const childClassJs = getClassStyle(childProperty.class);
  const parentClassJs = getClassStyle(parentProperty.class);
  const chileStyleJs = styleToJson(childProperty.style);
  const parentStyleJs = styleToJson(parentProperty.style);

  const finalProperty = {
    ...parentProperty,
    ...parentClassJs,
    ...parentStyleJs,
    ...childProperty,
    ...childClassJs,
    ...chileStyleJs,
  };

  let background;
  let gradientColors;
  let bkType;

  if (finalProperty.fill && finalProperty.fill.trim() === 'none') {
    // 无填充
  } else if (finalProperty.fill?.includes('url')) {
    const id: string = finalProperty.fill.replace('url(#', '').replace(')', '');
    if (gradientMap[id]) {
      gradientColors = gradientMap[id].color;
      bkType = 1;
    } else {
      let gradientColor = linearGradient.find((item) => item.id === id);
      if (gradientColor && !gradientColor.color) {
        gradientColor = linearGradient.find((item) => gradientColor.from === `#${item.id}`);
      }
      background = gradientColor?.color;
    }
  } else {
    background = finalProperty.fill;
    !background && (background = '#000');
  }

  let x = 0,
    y = 0;
  let rotate = 0;
  let matrix = null;

  if (finalProperty.transform) {
    const transforms = finalProperty.transform.split(') ');
    transforms.forEach((transform: string) => {
      const [type, value] = transform.split('(');
      if (!value) return;

      const [offsetX, offsetY] = value.split(/[\s,]+/);

      if (type === 'translate') {
        x = Number(offsetX) || 0;
        y = Number(offsetY) || 0;
      } else if (type === 'rotate') {
        rotate = parseFloat(value);
        x = 0;
        y = 0;
      } else if (type === 'matrix') {
        if (value.includes(',')) {
          matrix = value.split(',').map((item) => parseFloat(item));
        } else {
          matrix = value.split(' ').map((item) => parseFloat(item));
        }
      }
    });
  }

  if (isNaN(rotate)) {
    rotate = 0;
  }

  // 2.0版本的属性结构
  return {
    id: s8(),
    locked: 10,
    parentId,
    x,
    y,
    rotate,
    gradientColors,
    bkType,
    background: background,
    color: finalProperty.stroke === 'none' ? undefined : finalProperty.stroke,
    lineWidth:
      finalProperty.stroke === 'none'
        ? 0
        : finalProperty['stroke-width']
          ? parseFloat(finalProperty['stroke-width']) * shapeScale
          : finalProperty.stroke
            ? 1
            : 0,
    lineCap: finalProperty.strokeLinecap,
    lineJoin: finalProperty.strokeLinejoin,
    lineDash: finalProperty.strokeDasharray,
    lineDashOffset: finalProperty.strokeDashoffset,
    opacity: Number(finalProperty.opacity) || undefined, // 1.0的globalAlpha → 2.0的opacity
    fontSize: finalProperty['font-size'] ? parseFloat(finalProperty['font-size']) * shapeScale : 16,
    fontFamily: finalProperty['font-family'],
    fontWeight: finalProperty['font-weight'],
    fontStyle: finalProperty['font-style'],
    matrix,
    visible: !(finalProperty.visibility === 'hidden'),
  };
}

/**
 * 将polygon/polyline的points字符串转为坐标数组
 */
function polygonPointsToXY(points: string) {
  const _points = points.replace(/[\'\"\\\/\b\f\n\r\t]/g, '');
  const pointsArr = _points.split(/\s|,/);
  const resPoints = [];

  pointsArr.forEach((item: string, index: number) => {
    if (index % 2 === 0 && pointsArr[index + 1]) {
      resPoints.push({
        x: Number(item),
        y: Number(pointsArr[index + 1]),
      });
    }
  });

  return resPoints;
}

/**
 * 转换多边形
 */
function transformPolygon(childProperty: any, pen: any): any {
  const pointsStr = childProperty.points;
  const points = polygonPointsToXY(pointsStr);
  const rect = getRectOfPoints(points);

  // 2.0版本连线锚点使用绝对坐标
  const anchors = points.map((point) => {
    return {
      x: point.x - allRect.x + pen.x,
      y: point.y - allRect.y + pen.y,
      id: s8(),
    };
  });

  const x = rect.x - allRect.x + pen.x;
  const y = rect.y - allRect.y + pen.y;

  return {
    ...pen,
    type: 'line', // 1.0的name:'line' → 2.0的type:'line'
    lineName: 'line',
    category: 0, // polygon是封闭的，category为0
    close: true,
    anchors,
    x,
    y,
    ex: x + rect.width,
    ey: y + rect.height,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * 根据矩阵计算点的坐标
 */
function calcPointByMatrix(point: { x: number; y: number }, matrix: number[]) {
  const [a, b, c, d, e, f] = matrix;
  const oldX = point.x;
  const oldY = point.y;

  const x = a * oldX + c * oldY + e;
  const y = b * oldX + d * oldY + f;

  return [x, y];
}

/**
 * 转换line
 */
function transformLine(childProperty: any, pen: any) {
  let x1 = Number(childProperty.x1) || 0;
  let x2 = Number(childProperty.x2) || 0;
  let y1 = Number(childProperty.y1) || 0;
  let y2 = Number(childProperty.y2) || 0;

  if (Array.isArray(pen.matrix)) {
    [x1, y1] = calcPointByMatrix({ x: x1, y: y1 }, pen.matrix);
    [x2, y2] = calcPointByMatrix({ x: x2, y: y2 }, pen.matrix);
  }

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  // 2.0使用绝对坐标
  const x = minX - allRect.x + pen.x;
  const y = minY - allRect.y + pen.y;
  const width = maxX - minX;
  const height = maxY - minY;

  // 转换为绝对坐标
  const absX1 = x1 - allRect.x + pen.x;
  const absY1 = y1 - allRect.y + pen.y;
  const absX2 = x2 - allRect.x + pen.x;
  const absY2 = y2 - allRect.y + pen.y;

  return {
    ...pen,
    type: 'line', // 1.0的name:'line' → 2.0的type:'line'
    lineName: 'line',
    category: 1, // polyline类型
    x,
    y,
    ex: x + width,
    ey: y + height,
    width,
    height,
    length: Math.sqrt(Math.pow(absX2 - absX1, 2) + Math.pow(absY2 - absY1, 2)),
    anchors: [
      {
        x: absX1,
        y: absY1,
        id: s8(),
      },
      {
        x: absX2,
        y: absY2,
        id: s8(),
      },
    ],
  };
}

/**
 * 转换折线
 */
function transformPolyline(childProperty: any, pen: any) {
  const polyline = transformPolygon(childProperty, pen);
  return Object.assign(polyline, {
    close: false,
    category: 1, // 1.0的type:1 → 2.0的category:1
    anchors: polyline.anchors.map((anchor) => {
      anchor.visible = false; // 1.0的hidden:true → 2.0的visible:false
      return anchor;
    }),
  });
}

/**
 * 转换文本
 */
function transformText(childProperty, textContent, pen: any) {
  const text = textContent[0]?.[contentProp];
  const width = measureText(text, pen);
  const height = pen.fontSize || 16;

  let { offsetX, offsetY } = getTranslate(childProperty.transform);

  if (childProperty.fill && childProperty.fill !== 'none') {
    pen.color = childProperty.fill;
  }

  // 2.0使用绝对坐标
  return {
    ...pen,
    type: 'text', // 1.0的name:'text' → 2.0的type:'text'
    textAlign: 'left',
    text,
    x: parseFloat(childProperty.x) + (offsetX || 0) - allRect.x + pen.x,
    y: parseFloat(childProperty.y) + (offsetY || 0) - allRect.y + pen.y - height,
    width,
    height,
  };
}

/**
 * 转换图片
 */
function transformImage(childProperty, pen: any) {
  const { x, y, width, height } = childProperty;

  // 2.0使用绝对坐标
  return {
    ...pen,
    type: 'image', // 1.0的name:'image' → 2.0的type:'image'
    x: parseFloat(x) - allRect.x + pen.x,
    y: parseFloat(y) - allRect.y + pen.y,
    width: parseFloat(width),
    height: parseFloat(height),
    image: childProperty['xlink:href'],
  };
}

/**
 * 粗略计算文字宽度
 */
function measureText(text: string, pen: any) {
  const fontSize = pen.fontSize || 16;
  return (fontSize / shapeScale) * String(text).length;
}

/**
 * 样式字符串转JSON
 */
function styleToJson(style?: string) {
  if (!style) {
    return {};
  }

  const styleArr = style.split(';');
  const json = {};

  styleArr.forEach((item) => {
    const [key, value] = item.split(':');
    key && (json[key.trim()] = value?.trim());
  });

  return json;
}

/**
 * 设置全局样式
 */
function setStyle(defs: any[]) {
  defs.forEach((def) => {
    if (def.style && def.style[0]) {
      style = cssToJson(def.style[0][contentProp]);
    }
  });
}

/**
 * 设置线性渐变
 */
function setLinearGradient(defs: any[]) {
  defs.forEach((def) => {
    if (def.linearGradient) {
      const linearGradientItem: Gradient = {
        id: def[selfName].id,
        from: def[selfName]['xlink:href'],
        color: undefined,
      };

      if (def.linearGradient.length > 0) {
        linearGradientItem.color = def.linearGradient[0][selfName]['stop-color'];
      }

      linearGradient.push(linearGradientItem);
    }
  });
}

/**
 * 设置渐变映射
 */
function setGradient(defs: any[]) {
  defs.forEach((def) => {
    let { id, x1, x2, y1, y2 } = def[selfName];
    let deg = calculateAngle(x1, y1, x2, y2) + 90;
    let color = def.linearGradient
      .map((item) => item[selfName]['stop-color'] + ' ' + parseFloat(item[selfName].offset || 0) * 100 + '%')
      .join(',');

    gradientMap[id] = {
      color: `linear-gradient(${deg}deg,${color})`,
      points: [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ],
    };
  });
}

/**
 * 计算两点之间的角度
 */
function calculateAngle(x1, y1, x2, y2) {
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const angleInRadians = Math.atan2(deltaY, deltaX);
  const angleInDegrees = angleInRadians * (180 / Math.PI);
  return angleInDegrees;
}

/**
 * CSS字符串转JSON
 */
function cssToJson(text: string) {
  const json = {};
  const styleArr = text.split('}');

  styleArr.forEach((item) => {
    const [key, value] = item.split('{');
    key && (json[key.trim()] = styleToJson(value));
  });

  return json;
}

/**
 * 获取class对应的样式
 */
function getClassStyle(className: string) {
  const classStyle = {};

  for (const key in style) {
    if (Object.prototype.hasOwnProperty.call(style, key)) {
      const value = style[key];
      if (key === '.' + className || key.includes('.' + className + ',') || key.includes(',.' + className)) {
        Object.assign(classStyle, value);
      }
    }
  }

  return classStyle;
}

/**
 * 处理单位转换（如英寸转像素）
 */
function dealUnit(selfProperty: any): [number, number] {
  if (String(selfProperty.width)?.endsWith('in')) {
    const width = parseFloat(selfProperty.width) * 96;
    const height = parseFloat(selfProperty.height) * 96;
    return [width, height];
  }

  const width = parseFloat(selfProperty.width) || 0;
  const height = parseFloat(selfProperty.height) || 0;
  return [width, height];
}
