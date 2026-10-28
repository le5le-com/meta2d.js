import { calcAbsPoint, Pen, Point } from '../../models';
import { curve, line, mind } from '../line';
import { rectangleEdge, rectangle, square } from './rectangle';
import { leftArrow, rightArrow, twowayArrow } from './arrow';
import { circle } from './circle';
import { cloud } from './cloud';
import { diamond } from './diamond';
import { file } from './file';
import { hexagon } from './hexagon';
import { message } from './message';
import { pentagon, pentagonAnchors } from './pentagon';
import { people } from './people';
import { triangle, triangleAnchors } from './triangle';
import { pentagram } from './pentagram';
import { cube } from './cube';
import { svgPath } from './svgPath';

export const basePenDefines = [
  {
    type: 'line',
    draw: line,
  },
  {
    type: 'curve',
    draw: curve,
  },
  {
    type: 'mind',
    draw: mind,
  },
  {
    type: 'orthogonal',
    draw: line,
  },
  {
    type: 'rectangle',
    draw: rectangle,
    defaultAnchorFn,
    edgeFn: rectangleEdge,
  },
  {
    type: 'square',
    draw: square,
    defaultAnchorFn,
    edgeFn: rectangleEdge,
  },
  {
    type: 'leftArrow',
    draw: leftArrow,
    defaultAnchorFn,
  },
  {
    type: 'rightArrow',
    draw: rightArrow,
    defaultAnchorFn,
  },
  {
    type: 'twowayArrow',
    draw: twowayArrow,
    defaultAnchorFn,
  },
  {
    type: 'circle',
    draw: circle,
    defaultAnchorFn,
  },
  {
    type: 'cloud',
    draw: cloud,
    defaultAnchorFn,
  },
  {
    type: 'diamond',
    draw: diamond,
    defaultAnchorFn,
  },
  {
    type: 'file',
    draw: file,
    defaultAnchorFn,
  },
  {
    type: 'hexagon',
    draw: hexagon,
    defaultAnchorFn,
  },
  {
    type: 'message',
    draw: message,
    defaultAnchorFn,
  },
  {
    type: 'pentagon',
    draw: pentagon,
    defaultAnchorFn: pentagonAnchors,
  },
  {
    type: 'people',
    draw: people,
    defaultAnchorFn,
  },
  {
    type: 'triangle',
    draw: triangle,
    defaultAnchorFn: triangleAnchors,
  },
  {
    type: 'pentagram',
    draw: pentagram,
    defaultAnchorFn,
  },
  {
    type: 'cube',
    draw: cube,
    defaultAnchorFn,
  },
  {
    type: 'svgPath',
    draw: svgPath,
  }
];

const defaultAnchors = [
  {
    x: 0.5,
    y: 0,
  },
  {
    x: 1,
    y: 0.5,
  },
  {
    x: 0.5,
    y: 1,
  },
  {
    x: 0,
    y: 0.5,
  },
];

export function defaultAnchorFn(pen: Pen) {
  const anchors: Point[] = [];
  defaultAnchors.forEach((item, index) => {
    const { x, y } = calcAbsPoint(pen, item);
    anchors.push({ id: index.toString(), x, y });
  });
  return anchors;
}

const defaultAnchorIds = defaultAnchors.map((_, i) => i.toString());

/**
 * anchors 是否与 defaultAnchorFn(pen) 此刻会生成的逐字段相同（同样的 id、同样算式算出的 x / y、没有别的字段）。
 * 不分配：100 万图元时每个都要判一次。
 */
export function isDefaultAnchors(pen: Pen, anchors: Point[]) {
  if (!anchors || anchors.length !== defaultAnchors.length) {
    return false;
  }
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const d = defaultAnchors[i];
    // 与 calcAbsPoint 同一个算式，浮点结果逐位相同
    if (a.id !== defaultAnchorIds[i] || a.x !== pen.x + pen.width * d.x || a.y !== pen.y + pen.height * d.y) {
      return false;
    }
    let n = 0;
    for (const _ in a) {
      n++;
    }
    if (n !== 3) {
      return false;
    }
  }
  return true;
}

/**
 * 发给 worker 前把默认锚点临时拿掉（worker 收到后用 fillDefaultAnchors 按同一算式重算回来）。
 *
 * 锚点占一个普通图元结构化克隆开销的 ~60%（4 个小对象 + 数组；20 万个矩形：带锚点 581ms，不带 232ms），
 * 而绝大多数图元的锚点就是 dealData 按 defaultAnchorFn 生成的那 4 个 —— worker 自己算一遍比收一遍便宜得多。
 * 只拿掉与 defaultAnchorFn(pen) 逐字段相同的（isDefaultAnchors），改过、连过线（锚点上有别的字段）的照常发。
 *
 * 用法：elide → postMessage（带上 mask）→ restore。必须同步配对，中间不能让别的代码看到 anchors 为空的图元。
 * 原地改 pen.anchors 而不是另拷一份图元：拷 100 万个对象本身就比省下的还贵。
 *
 * @returns mask：第 i 个图元的锚点被拿掉了（没有就是 undefined，不必发）
 */
export function elideDefaultAnchors(pens: Pen[]) {
  let mask: Uint8Array | undefined;
  let saved: Point[][] | undefined;
  for (let i = 0; i < pens.length; i++) {
    const pen = pens[i];
    const a = pen.anchors;
    if (!a || !isDefaultAnchors(pen, a)) {
      continue;
    }
    if (!mask) {
      mask = new Uint8Array(pens.length);
      saved = new Array(pens.length);
    }
    mask[i] = 1;
    saved[i] = a;
    pen.anchors = undefined;
  }
  return {
    mask,
    restore() {
      if (!mask) {
        return;
      }
      for (let i = 0; i < pens.length; i++) {
        mask[i] && (pens[i].anchors = saved[i]);
      }
    },
  };
}

/** worker 侧：按 elideDefaultAnchors 的 mask 把默认锚点算回来 */
export function fillDefaultAnchors(pens: Pen[], mask?: Uint8Array) {
  if (!mask || !pens) {
    return;
  }
  for (let i = 0; i < pens.length; i++) {
    mask[i] && (pens[i].anchors = defaultAnchorFn(pens[i]));
  }
}
