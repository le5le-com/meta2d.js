import { getRectOfPoints, Pen, Rect, s8 } from '@meta2d/core';
import { getRect, parseSvgPath } from '@meta2d/core/src/diagrams/svg/parse';
import { XMLParser } from 'fast-xml-parser/src/fxp';

const selfName = ':@';

let allRect: Rect;
let shapeScale: number; // 图形缩小比例
let anchorsArr = [];
// globalThis.parseSvg = parseSvg; //  测试
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
  svgs.forEach((svg) => {
    const selfProperty = svg[selfName];
    allRect = transformContainerRect(selfProperty);
    const isWidthLitter = allRect.width < allRect.height; // 宽小于高
    // 长边等于 40
    if (!isWidthLitter) {
      if (!selfProperty.width) {
        selfProperty.width = 40;
      }
      shapeScale = selfProperty.width / allRect.width;
      !selfProperty.height &&
        (selfProperty.height = shapeScale * allRect.height);
    } else {
      // 高小于宽
      if (!selfProperty.height) {
        selfProperty.height = 40;
      }
      shapeScale = selfProperty.height / allRect.height;
      !selfProperty.width && (selfProperty.width = shapeScale * allRect.width);
    }

    const children: any[] = svg.svg;
    const combinePens: Pen[] = transformCombines(selfProperty, children);

    pens.push(...combinePens);
  });
  setAnchor(pens[0]);
  return pens;
}

function setAnchor(pen: Pen) {
  anchorsArr = anchorsArr.map((item, index) => {
    return {
      id: index + '',
      penId: pen.id,
      x: item.x,
      y: item.y,
    };
  });
  pen.anchors = anchorsArr;
}

function transformCombines(selfProperty, children: any[]): Pen[] {
  const pens: Pen[] = [];
  const [width, height] = dealUnit(selfProperty);
  const combinePen: Pen = {
    id: s8(),
    name: 'combine',
    x: selfProperty.x, // 最外层的 conbine 用不到该属性
    y: selfProperty.y,
    locked: selfProperty.locked,
    width,
    height,
    children: [],
  };
  pens.push(combinePen);
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
      // g 类型
      pen = transformCombines(
        {
          // TODO: g 暂时认为是与父元素一样大
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          locked: 10, // 内层的 combine locked 10
          ...childProperty,
        },
        child.g
      );
    } else if (child.defs) {
      setStyle(child.defs.filter((item) => item.style));
      setLinearGradient(child.defs.filter((item) => item.linearGradient));
    } else if (child.style) {
      setStyle([{ style: child.style }]);
    } else if (childProperty) {
      pen = transformNormalShape(childProperty, selfProperty, combinePen.id);
      if (child.path) {
        // path 类型
        pen = transformPath(childProperty, pen);
      } else if (child.rect) {
        // rect 类型
        pen = transformRect(childProperty, pen);
        const rectangle: Pen = pen;
        //获取圆上右下左坐标
        let circleAnchors = [
          {
            x: rectangle.x + rectangle.width * 0.5,
            y: rectangle.y,
          },
          {
            x: rectangle.x + rectangle.width * 1,
            y: rectangle.y + rectangle.height * 0.5,
          },
          {
            x: rectangle.x + rectangle.width * 0.5,
            y: rectangle.y + rectangle.height * 1,
          },
          {
            x: rectangle.x,
            y: rectangle.y + rectangle.height * 0.5,
          },
        ];
        circleAnchors.forEach((item) => {
          if (
            item.x <= 0.01 ||
            item.x >= 0.99 ||
            item.y <= 0.01 ||
            item.y >= 0.99
          ) {
            anchorsArr.push(item);
          }
        });
      } else if (child.circle) {
        // circle 类型
        pen = transformCircle(childProperty, pen);
        const circle: Pen = pen;
        //获取圆上右下左坐标
        let circleAnchors = [
          {
            x: circle.x + circle.width * 0.5,
            y: circle.y,
          },
          {
            x: circle.x + circle.width * 1,
            y: circle.y + circle.height * 0.5,
          },
          {
            x: circle.x + circle.width * 0.5,
            y: circle.y + circle.height * 1,
          },
          {
            x: circle.x,
            y: circle.y + circle.height * 0.5,
          },
        ];
        circleAnchors.forEach((item) => {
          if (
            item.x <= 0.01 ||
            item.x >= 0.99 ||
            item.y <= 0.01 ||
            item.y >= 0.99
          ) {
            anchorsArr.push(item);
          }
        });
      } else if (child.ellipse) {
        // ellipse 类型
        pen = transformCircle(childProperty, pen);
      } else if (child.line) {
        // line 类型
        pen = transformLine(childProperty, pen);
        const line: Pen = pen;
        line.anchors.forEach((item) => {
          const x = line.x + item.x * line.width;
          const y = line.y + item.y * line.height;
          if (x < 0.01 || x > 0.99 || y < 0.01 || y > 0.99) {
            //TODO 连线太多的问题
            anchorsArr.push({
              x,
              y,
            });
          }
        });
      } else if (child.polygon) {
        // polygon 类型
        pen = transformPolygon(childProperty, pen);
      } else if (child.polyline) {
        // polyline 类型
        pen = transformPolyline(childProperty, pen);
        const polyline: Pen = pen;
        polyline.anchors.forEach((item) => {
          const x = polyline.x + item.x * polyline.width;
          const y = polyline.y + item.y * polyline.height;
          if (x < 0.01 || x > 0.99 || y < 0.01 || y > 0.99) {
            anchorsArr.push({
              x,
              y,
            });
          }
        });
      } else if (child.text) {
        // text 类型
        pen = transformText(childProperty, child.text, pen);
      } else if (child.image) {
        // image 类型
        pen = transformImage(childProperty, pen);
        // TODO: use 类型节点暂不考虑
      } else {
        pen = undefined;
      }
    }
    if (pen) {
      // 此处 pen 在 g 的 情况下可能是个数组
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
  return pens;
}

function getTranslate(transform: string) {
  let offsetX = 0;
  let offsetY = 0;
  if (transform) {
    let matchArr = transform
      .replace('translate(', '')
      .replace(')', '')
      .split(',');
    offsetX = parseFloat(matchArr[0]);
    offsetY = parseFloat(matchArr[1]);
  }
  return {
    offsetX,
    offsetY,
  };
}
function transformPath(path: any, pen: any): any {
  let d = path.d;
  if (!d) {
    return;
  }
  let commands = parseSvgPath(d);
  let rect = getRect(commands);
  let { offsetX, offsetY } = getTranslate(path.transform);
  rect.x += offsetX;
  rect.ex += offsetX;
  rect.y += offsetY;
  rect.ey += offsetY;
  const x = (rect.x + pen.x - allRect.x) / allRect.width;
  const y = (rect.y + pen.y - allRect.y) / allRect.height;
  const width =
    rect.width / allRect.width <= 1 ? rect.width / allRect.width : 1;
  const height =
    rect.height / allRect.height <= 1 ? rect.height / allRect.height : 1;

  const pathPen = {
    ...pen,
    name: 'svgPath',
    pathId: s8(), // 同样的 pathId ，避免重复存储 path
    path: d,
    x,
    y,
    width,
    height,
    disableAnchor: true,
  };

  return pathPen;
}

function transformRect(rect: any, pen: any): any {
  const x = (rect.x || 0 - allRect.x + pen.x) / allRect.width;
  const y = (rect.y || 0 - allRect.y + pen.y) / allRect.height;
  const width =
    rect.width / allRect.width <= 1 ? rect.width / allRect.width : 1;
  const height =
    rect.height / allRect.height <= 1 ? rect.height / allRect.height : 1;
  const borderRadius = rect.rx / rect.width || rect.ry / rect.height || 0;
  const rectPen = {
    ...pen,
    name: 'rectangle',
    x,
    y,
    width,
    height,
    borderRadius,
  };
  return rectPen;
}

/**
 * 转换圆形或者椭圆标签成为 circle
 * @param circle 圆形或者椭圆
 * @returns
 */
function transformCircle(circle: any, pen: any): any {
  const rx = circle.rx || circle.r;
  const ry = circle.ry || circle.r;
  const x = (circle.cx - rx - allRect.x + pen.x) / allRect.width;
  const y = (circle.cy - ry - allRect.y + pen.y) / allRect.height;
  const width = (2 * rx) / allRect.width;
  const height = (2 * ry) / allRect.height;
  return {
    ...pen,
    name: 'circle',
    x,
    y,
    width,
    height,
  };
}

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
      width: parseFloat(mySelf.width),
      height: parseFloat(mySelf.height),
    };
  }
}
function transformNormalShape(
  childProperty: any,
  parentProperty,
  parentId: string
): any {
  // style > class > self
  const childClassJs = getClassStyle(childProperty.class);
  const parentClassJs = getClassStyle(parentProperty.class);
  // childProperty 的优先级更高
  // style 的优先级更高
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
  if (finalProperty.fill === 'none') {
  } else if (finalProperty.fill?.includes('url')) {
    const id: string = finalProperty.fill.replace('url(#', '').replace(')', '');
    let gradientColor = linearGradient.find((item) => item.id === id);
    if (gradientColor && !gradientColor.color) {
      // 颜色不存在，则查找父级
      gradientColor = linearGradient.find(
        (item) => gradientColor.from === `#${item.id}`
      );
    }
    background = gradientColor?.color;
  } else {
    background = finalProperty.fill;
    // fill 属性不是 none ，是 undefined ，用默认黑色
    !background && (background = '#000');
  }

  let x = 0,
    y = 0;
  let rotate = 0;
  if (finalProperty.transform) {
    const transforms = finalProperty.transform.split(') ');
    transforms.forEach((transform: string) => {
      const [type, value] = transform.split('(');
      const [offsetX, offsetY] = value.split(' ');
      if (type === 'translate') {
        // 平移
        x = Number(offsetX) || 0;
        y = Number(offsetY) || 0;
      }
      if (type === 'rotate') {
        // TODO: transform 中的 rotate 圆心与 meta2d.js 圆心不一致，处理过程中默认把 translate 干掉
        // 旋转
        rotate = parseFloat(value);
        x = 0;
        y = 0;
      }
    });
  }

  return {
    id: s8(),
    locked: 10,
    parentId,
    x,
    y,
    rotate,
    // TODO: background 可以为空
    background: background,
    color: finalProperty.stroke,
    lineWidth: finalProperty['stroke-width']
      ? parseFloat(finalProperty['stroke-width']) * shapeScale
      : finalProperty.stroke
      ? 1
      : 0,
    lineCap: finalProperty.strokeLinecap,
    lineJoin: finalProperty.strokeLinejoin,
    lineDash: finalProperty.strokeDasharray, // TODO: 可能不是数组类型
    lineDashOffset: finalProperty.strokeDashoffset,
    // strokeMiterlimit: path.strokeMiterlimit,
    globalAlpha: Number(finalProperty.opacity),
    // transform: path.transform,
    fontSize: finalProperty['font-size']
      ? parseFloat(finalProperty['font-size']) * shapeScale
      : 16,
    fontFamily: finalProperty['font-family'],
    fontWeight: finalProperty['font-weight'],
    fontStyle: finalProperty['font-style'],
  };
}

/**
 * 由于 points 存在 不使用 , 分割的特例（全部使用 ' '）
 * @param points 字符串 points
 * @returns
 */
function polygonPointsToXY(points: string) {
  const pointsArr = points.split(/\s|,/);
  const resPoints = [];
  pointsArr.forEach((item: string, index: number) => {
    if (index % 2 === 0) {
      resPoints.push({
        x: Number(item),
        y: Number(pointsArr[index + 1]),
      });
    }
  });
  return resPoints;
}

function transformPolygon(childProperty: any, pen: any): any {
  const pointsStr = childProperty.points;

  const points = polygonPointsToXY(pointsStr);

  const rect = getRectOfPoints(points);
  const anchors = points.map((point) => {
    return {
      x: (point.x - rect.x) / rect.width,
      y: (point.y - rect.y) / rect.height,
      id: s8(),
    };
  });

  return {
    ...pen,
    name: 'line',
    lineName: 'line',
    type: 0,
    close: true,
    anchors,
    x: (rect.x - allRect.x + pen.x) / allRect.width,
    y: (rect.y - allRect.y + pen.y) / allRect.height,
    width: rect.width / allRect.width,
    height: rect.height / allRect.height,
  };
}

function transformLine(childProperty: any, pen: any) {
  const x1 = Number(childProperty.x1) || 0;
  const x2 = Number(childProperty.x2) || 0;
  const y1 = Number(childProperty.y1) || 0;
  const y2 = Number(childProperty.y2) || 0;
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  const x = (minX - allRect.x + pen.x) / allRect.width;
  const y = (minY - allRect.y + pen.y) / allRect.height;
  const width = (maxX - minX) / allRect.width;
  const height = (maxY - minY) / allRect.height;

  return {
    ...pen,
    name: 'line',
    lineName: 'line',
    type: 0,
    x,
    y,
    width,
    height,
    anchors: [
      {
        x: x1 < x2 ? 0 : 1,
        y: y1 < y2 ? 0 : 1,
        hidden: true,
        id: s8(),
      },
      {
        x: x1 < x2 ? 1 : 0,
        y: y1 < y2 ? 1 : 0,
        hidden: true,
        id: s8(),
      },
    ],
  };
}

function transformPolyline(childProperty: any, pen: any) {
  // 多段直线
  const polyline = transformPolygon(childProperty, pen);
  return Object.assign(polyline, {
    close: false,
    type: 1,
    anchors: polyline.anchors.map((anchor) => {
      anchor.hidden = true;
      return anchor;
    }),
  });
}

function transformText(childProperty, textContent, pen: any) {
  // 文字
  const text = textContent[0]?.[contentProp];
  const width = measureText(text, pen);
  const height = 0; // pen.fontSize / shapeScale;
  //TODO 这里为什么需要减去height
  let { offsetX, offsetY } = getTranslate(childProperty.transform);
  return {
    ...pen,
    name: 'text',
    textAlign: 'left',
    text,
    x:
      (parseFloat(childProperty.x) + (offsetX || 0) - allRect.x + pen.x) /
      allRect.width,
    y:
      (parseFloat(childProperty.y) +
        (offsetY || 0) -
        allRect.y +
        pen.y -
        height) /
      allRect.height,
    width: width / allRect.width,
    height: height / allRect.height,
  };
}

function transformImage(childProperty, pen: any) {
  const { x, y, width, height } = childProperty;
  return {
    ...pen,
    name: 'image',
    x: (x - allRect.x + pen.x) / allRect.width,
    y: (y - allRect.y + pen.y) / allRect.height,
    width: width / allRect.width,
    height: height / allRect.height,
    image: childProperty['xlink:href'],
  };
}

// TODO: 粗糙计算文字宽度
function measureText(text: string, pen: any) {
  const fontSize = pen.fontSize || 16;
  return (fontSize / shapeScale) * String(text).length;
}

function styleToJson(style?: string) {
  if (!style) {
    return {};
  }
  const styleArr = style.split(';');
  const json = {};
  styleArr.forEach((item) => {
    const [key, value] = item.split(':');
    key && (json[key] = value);
  });
  return json;
}

const contentProp = '#text';
let style = undefined;
function setStyle(defs: any[]) {
  defs.forEach((def) => {
    if (def.style && def.style[0]) {
      // TODO: 暂时只支持一个 style 的情况
      style = cssToJson(def.style[0][contentProp]);
    }
  });
}

// TODO: 渐变中目前只存储一个颜色 渐变
let linearGradient: Gradient[] = [];

interface Gradient {
  id: string; // 当前的 id 值
  from: string; // 该渐变来自于哪个渐变 即 xlink:href 属性， 比 id 多一个 #
  color: string; // 颜色，from 存在时，该值应该不存在
}
function setLinearGradient(defs: any[]) {
  // 此处的 defs 数组是只包含 linearGradient 属性的
  defs.forEach((def) => {
    if (def.linearGradient) {
      const linearGradientItem: Gradient = {
        id: def[selfName].id,
        from: def[selfName]['xlink:href'],
        color: undefined,
      };
      if (def.linearGradient.length > 0) {
        linearGradientItem.color =
          def.linearGradient[0][selfName]['stop-color'];
      }
      linearGradient.push(linearGradientItem);
    }
  });
}

function cssToJson(text: string) {
  const json = {};
  const styleArr = text.split('}');
  styleArr.forEach((item) => {
    const [key, value] = item.split('{');
    key && (json[key] = styleToJson(value));
  });
  return json;
}

function getClassStyle(className: string) {
  const classStyle = {};
  for (const key in style) {
    if (Object.prototype.hasOwnProperty.call(style, key)) {
      const value = style[key];
      if (key.includes(className)) {
        Object.assign(classStyle, value);
      }
    }
  }
  return classStyle;
}
/**
 * 处理单位，目前只考虑到 in 英寸 ，其它的返回原值
 * @param selfProperty 当前元素的属性
 * @returns
 */
function dealUnit(selfProperty: any): [number, number] {
  if (String(selfProperty.width)?.endsWith('in')) {
    // 英寸
    const width = parseFloat(selfProperty.width) * 96;
    const height = parseFloat(selfProperty.height) * 96;
    return [width, height];
  }
  const width = parseFloat(selfProperty.width) || 0;
  const height = parseFloat(selfProperty.height) || 0;
  return [width, height];
}
