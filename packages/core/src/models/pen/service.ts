import { Direction, Point } from '../point';
import { getDirection, getOrthogonalPoint, rotatePoint, simplifyOrthogonalPoints } from '../point/service';
import { expandRect, getRectOfPoints, Rect, rotateRect, translateRect } from '../rect';
import { BackgroundType, PatchFlag, PenCategory, TextAlign, TextVertical, TextWrap } from './const';
import { Pen } from './pen';
import { Vector2D } from '../../math';
import { s8 } from '../../utils';
import { Gradient } from './types';
import { GradientType, Align } from './const';
import { defaultAnchorFns } from './handle';
import { getCurveSegmentPoints, getLineSegmentsLength, getSegmentPointByPosition } from './line';

const ellipsis = '...';

/**
 * 第六十八轮：锚点的快速拷贝，代替 patchClone 里的 structuredClone。
 * 多选 416 个矩形缩放 / 旋转时，每一步要 patchClone 两次、每个带 4 个锚点：离线 node 里
 * 7 µs/图元的 90% 是 structuredClone(anchors)（每次都要走一遍通用的结构化克隆）。
 * 锚点是平铺的纯数据（见 Point），嵌套只有 cp1 / cp2；数组、嵌套对象照样深拷贝，其余字段按值复制 ——
 * 对这种形状与 structuredClone 的结果逐字段相同（离线对照见设计文档第六十八轮）。
 * 遇到非纯数据（函数、Date、Map…）就退回 structuredClone，保持原来的语义。
 */
function cloneAnchors(anchors: Point[]): Point[] {
  const out = new Array(anchors.length);
  for (let i = 0; i < anchors.length; i++) {
    const a = cloneAnchorValue(anchors[i]);
    if (a === FALLBACK) {
      return structuredClone(anchors);
    }
    out[i] = a;
  }
  return out;
}

const FALLBACK = {};

function cloneAnchorValue(v: any): any {
  if (v === null || typeof v !== 'object') {
    return typeof v === 'function' || typeof v === 'symbol' ? FALLBACK : v;
  }
  if (Array.isArray(v)) {
    const arr = new Array(v.length);
    for (let i = 0; i < v.length; i++) {
      const c = cloneAnchorValue(v[i]);
      if (c === FALLBACK) {
        return FALLBACK;
      }
      arr[i] = c;
    }
    return arr;
  }
  if (Object.getPrototypeOf(v) !== Object.prototype) {
    return FALLBACK;
  }
  const o: any = {};
  for (const k in v) {
    const c = cloneAnchorValue(v[k]);
    if (c === FALLBACK) {
      return FALLBACK;
    }
    o[k] = c;
  }
  return o;
}

export function patchClone(pen: Pen, props?: any) {
  const item: Pen = {
    id: pen.id,
    category: pen.category,
    type: pen.type,
    x: pen.x,
    y: pen.y,
    ex: pen.ex,
    ey: pen.ey,
    width: pen.width,
    height: pen.height,
    rotate: pen.rotate,
    scale: pen.scale,
    flipX: pen.flipX,
    flipY: pen.flipY,
    lineWidth: pen.lineWidth,
    borderRadius: pen.borderRadius,
    close: pen.close,
    length: pen.length,
    index: pen.index,
    interactive: pen.interactive,
    locked: pen.locked,
    visible: pen.visible,
    bkType: pen.bkType,
    disableAnchor: pen.disableAnchor,
  };

  // 可选样式字段只有在原图元中真实存在时才复制，避免克隆过程制造 undefined 属性。
  // 对已经显式设置为 undefined 的字段仍然保留键，便于补丁同步时清除 Worker 中的旧值。
  const optionalStyleKeys: (keyof Pen)[] = [
    'shadowColor',
    'shadowBlur',
    'shadowOffsetX',
    'shadowOffsetY',
    'textShadow',
    'textShadowColor',
    'textShadowBlur',
    'textShadowOffsetX',
    'textShadowOffsetY',
  ];
  const itemRecord = item as Record<string, unknown>;
  for (const key of optionalStyleKeys) {
    if (Object.prototype.hasOwnProperty.call(pen, key)) {
      itemRecord[key] = (pen as Record<string, unknown>)[key];
    }
  }
  if (pen.anchors) {
    item.anchors = cloneAnchors(pen.anchors);
  }
  if (pen.connectedLines) {
    item.connectedLines = structuredClone(pen.connectedLines);
  }
  if (pen.pivot) {
    item.pivot = { x: pen.pivot.x, y: pen.pivot.y };
  }
  if (pen.lineIsEdge) {
    item.lineIsEdge = pen.lineIsEdge;
  }
  // 连线拐角圆角：worker 里的连线副本都来自 patchClone，缺了它 hover 效果画成尖角、calc 拾取也按尖角算。
  // 带上 key（值可以是 undefined）而不是有值才带：改回 0 / 去掉时 Object.assign 也要能把旧值覆盖掉
  if ('lineSmooth' in pen) {
    item.lineSmooth = pen.lineSmooth;
  }
  if (pen.textAutoSize) {
    item.textAutoSize = true;
  }
  if (pen.fromArrowSize) {
    item.fromArrowSize = pen.fromArrowSize;
  }
  if (pen.toArrowSize) {
    item.toArrowSize = pen.toArrowSize;
  }

  if (props) {
    return Object.assign(item, props);
  }
  return item;
}

export function setBackgrounds(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  images?: { [key: string]: CanvasImageSource }
) {
  pen.fillStyles = [];
  for (const bg of pen.backgrounds) {
    switch (bg.type) {
      case BackgroundType.LinearGradient:
      case BackgroundType.RadialGradient:
        if (bg.gradient) {
          pen.fillStyles.push(createBackgroundGradient(ctx, pen, bg.gradient));
        }
        break;
      case BackgroundType.Image:
        if (bg.image && images && images[bg.image]) {
          pen.fillStyles.push(ctx.createPattern(images[bg.image], bg.imageRepetition));
        }
        break;
      default:
        if (bg.color) {
          pen.fillStyles.push(bg.color);
        }
        break;
    }
  }
}

export function setBackground(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  images?: { [key: string]: CanvasImageSource },
) {
  pen.fillStyles = [];
  switch (pen.bkType) {
    case BackgroundType.LinearGradient:
    case BackgroundType.RadialGradient:
      if (pen.gradient) {
        pen.fillStyles.push(createBackgroundGradient(ctx, pen, pen.gradient));
      }
      break;
    case BackgroundType.Image:
      if (pen.backgroundImage && images && images[pen.backgroundImage]) {
        pen.fillStyles.push(ctx.createPattern(images[pen.backgroundImage], 'repeat'));
      }
      break;
    default:
      if (pen.background) {
        pen.fillStyles.push(pen.background);
      }
      break;
  }
}

export function flipRender(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, pen: Pen) {
  if (pen.flipX) {
    ctx.translate(pen.x + pen.ex, 0);
    ctx.scale(-1, 1);
  }
  if (pen.flipY) {
    ctx.translate(0, pen.y + pen.ey);
    ctx.scale(1, -1);
  }
}

export function intPenCoordinates(pen: Pen) {
  pen.x |= 0;
  pen.y |= 0;
  pen.width = Math.round(pen.width);
  pen.height = Math.round(pen.height);
  pen.ex = pen.x + pen.width;
  pen.ey = pen.y + pen.height;
}

export function rotateRender(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, pen: Pen) {
  const { x, y } = pen.pivot;
  ctx.translate(x, y);
  let rotate = (pen.rotate * Math.PI) / 180;
  if (pen.flipX) {
    rotate *= -1;
  }
  if (pen.flipY) {
    rotate *= -1;
  }
  ctx.rotate(rotate);
  ctx.translate(-x, -y);
}

export function getFont(
  pen: {
    fontStyle?: string;
    fontWeight?: string;
    fontSize?: number;
    fontFamily?: string;
    lineHeight?: number;
  },
  data?: {
    fontStyle?: string;
    fontWeight?: string;
    fontSize?: number;
    fontFamily?: string;
    lineHeight?: number;
  }
) {
  // 按照优先级取值：pen -> data -> options -> 默认值
  const fontStyle = pen.fontStyle ?? data?.fontStyle ?? 'normal';
  const fontWeight = pen.fontWeight ?? data?.fontWeight ?? 'normal';
  const fontSize = pen.fontSize ?? data?.fontSize ?? 12;
  const fontFamily = pen.fontFamily ?? data?.fontFamily ?? 'Arial';
  const lineHeight = pen.lineHeight ?? data?.lineHeight ?? 1.5;

  return `${fontStyle} ${fontWeight} ${fontSize}px/${lineHeight} ${fontFamily}`;
}

export function createLineGradient(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  gradient?: Gradient
): CanvasGradient {
  return createGradient(ctx, pen.x, pen.y, pen.width, pen.height, gradient || pen.lineGradient || {});
}

export function createTextGradient(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  gradient?: Gradient
): CanvasGradient {
  return createGradient(
    ctx,
    pen.textRectX,
    pen.textRectY,
    pen.textRectWidth,
    pen.textRectHeight,
    gradient || pen.textGradient || {}
  );
}

export function createBackgroundGradient(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  gradient: Gradient
): CanvasGradient {
  return createGradient(ctx, pen.x, pen.y, pen.width, pen.height, gradient);
}

export function createGradient(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gradientConfig: Gradient
): CanvasGradient {
  let gradient: CanvasGradient;

  const x0 = x + w * gradientConfig.x0;
  const y0 = y + h * gradientConfig.y0;
  const x1 = x + w * gradientConfig.x1;
  const y1 = y + h * gradientConfig.y1;

  if (gradientConfig.type === GradientType.Radial) {
    const r = h > w ? h : w;
    gradient = ctx.createRadialGradient(x0, y0, r * gradientConfig.r0, x0, y0, r * gradientConfig.r1);
  } else {
    gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  }

  for (const item of gradientConfig.colorStops) {
    gradient.addColorStop(item.i, item.color);
  }

  return gradient;
}

export function canvasLinerGradientToCss(gradient: Gradient): string {
  if (
    !gradient ||
    gradient.type > 1 ||
    !gradient.colorStops ||
    gradient.colorStops.length === 0 ||
    gradient.x0 === undefined ||
    gradient.y0 === undefined ||
    gradient.x1 === undefined ||
    gradient.y1 === undefined
  ) {
    return '';
  }

  const { x0, y0, x1, y1, colorStops } = gradient;

  const dx = x1 - x0;
  const dy = y1 - y0;

  let rad = Math.atan2(dy, dx) + Math.PI / 2;
  if (rad < 0) rad += 2 * Math.PI;
  const angle = (rad * 180) / Math.PI;

  const stopsStr = colorStops
    .map(({ color, i }) => {
      const percent = Math.round(i * 100);
      return `${color} ${percent}%`;
    })
    .join(',');

  return `linear-gradient(${Math.round(angle)}deg,${stopsStr})`;
}

export function canvasRadialGradientToCss(gradient: Gradient): string {
  if (
    !gradient ||
    !gradient.colorStops ||
    gradient.colorStops.length === 0 ||
    gradient.x0 === undefined ||
    gradient.y0 === undefined ||
    gradient.x1 === undefined ||
    gradient.y1 === undefined
  ) {
    return '';
  }

  // 计算方向角度
  const cx = 0.5;
  const cy = 0.5;

  const dx0 = gradient.x0 - cx;
  const dy0 = gradient.y0 - cy;
  const dx1 = gradient.x1 - cx;
  const dy1 = gradient.y1 - cy;

  const rad = Math.atan2(dy1 - dy0, dx1 - dx0);
  let angle = (rad * 180) / Math.PI;
  if (angle < 0) angle += 360;

  const stopsStr = gradient.colorStops
    .map(({ color, i }) => {
      const percent = Math.round(i * 100);
      return `${color} ${percent}%`;
    })
    .join(',');

  return `linear-gradient(${Math.round(angle)}deg,${stopsStr})`;
}

export function gradientToCss(gradient: Gradient): string {
  if (
    !gradient ||
    gradient.x0 === undefined ||
    gradient.y0 === undefined ||
    gradient.x1 === undefined ||
    gradient.y1 === undefined
  ) {
    return '';
  }

  if (gradient.type > 1) {
    return canvasRadialGradientToCss(gradient);
  }

  return canvasLinerGradientToCss(gradient);
}

/**
 * 视口筛选里「小到不用画」的图元：宽或高 < 2 的节点。
 * 连线不算 —— 水平 / 垂直连线的 width 或 height 恰好是 0，按这条规则会被整条丢掉
 * （平移出视口再回来、缩放后全量重绘时不显示，框选也选不中）。
 * calc 的 calcInViewPens、render 的窄带选取、主线程的框选（selectPensDone）共用这一个判定 ——
 * 前两者不一致会让平移快路径与全量重绘画面不同。
 */
export function isTinyPen(pen: Pen) {
  return pen.category !== PenCategory.Line && (pen.width < 2 || pen.height < 2);
}

/**
 * 根据连线真实路径重新计算长度和包围盒。
 *
 * anchors 变化后必须同步这些派生字段，否则视口筛选和局部重绘仍会使用旧矩形，
 * 导致真实路径进入可视区域后没有被重新绘制。
 */
export function calcLineRect(line: Pen): Rect {
  if (line.calculative) {
    delete line.calculative.lineSegments;
    delete line.calculative.gradientSegments;
  }

  const points = getCurveSegmentPoints(line, 0.02, true, true);
  line.length = getLineSegmentsLength(points);

  const rect = getRectOfPoints(points);
  if (line.lineWidth >= 2 || line.fromArrow || line.toArrow) {
    expandRect(
      rect,
      Math.max(
        Math.round((line.lineWidth || 1) / 2),
        line.fromArrowSize || 0,
        line.toArrowSize || 0,
        10,
      ),
    );
  }

  Object.assign(line, rect);
  line.pivot = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };

  return rect;
}

export function dealData(pens: Pen[], penMap?: Map<string, any>) {
  if (!pens) {
    return;
  }

  let animatePens = [];

  let index = 0;
  if (penMap && penMap.size > 0) {
    // 找到当前最大的 index
    let maxIndex = -1;
    for (const pen of penMap.values()) {
      if (pen.index !== undefined && pen.index > maxIndex) {
        maxIndex = pen.index;
      }
    }
    index = maxIndex + 1;
  }

  for (const pen of pens) {
    // 拖拽或打开外部图元时，清理顶层未配置字段，避免属性面板出现 undefined 空配置。
    // 仅处理顶层字段，嵌套配置的结构由对应图元自行维护。
    const penRecord = pen as Record<string, unknown>;
    for (const key of Object.keys(penRecord)) {
      if (penRecord[key] === undefined) {
        delete penRecord[key];
      }
    }

    pen.index = index++;
    if (!pen.id) {
      pen.id = s8();
    }
    if (!pen.rotate) {
      pen.rotate = 0;
    }

    // 兼容历史数据：部分连线只更新了 anchors，保存的包围盒仍是旧值。
    if (pen.category === PenCategory.Line && pen.anchors?.length >= 2) {
      calcLineRect(pen);
    } else {
      if (!pen.ex) {
        pen.ex = pen.x + pen.width;
      }
      if (!pen.ey) {
        pen.ey = pen.y + pen.height;
      }
      if (!pen.pivot) {
        pen.pivot = { x: pen.x + pen.width / 2, y: pen.y + pen.height / 2 };
      }
    }

    if (!pen.anchors && defaultAnchorFns[pen.type]) {
      const anchors = defaultAnchorFns[pen.type](pen);
      if (anchors?.length) {
        pen.anchors = anchors;
      }
    }

    if (penMap) {
      penMap.set(pen.id, pen);
    }

    if (pen.autoPlay) {
      animatePens.push(pen);
    }
  }

  // mind 连线的控制柄由连接节点方向推导，打开画布或增量加入图元后统一补齐。
  const allPens = penMap ? Array.from(penMap.values()) : pens;
  const nodes = allPens.filter((pen) => pen.category !== PenCategory.Line);
  const mindLines = allPens.filter((pen) => pen.category === PenCategory.Line && pen.type === 'mind');
  if (mindLines.length) {
    updateConnectedLines(mindLines, nodes);
  }

  return animatePens;
}

export function makePenId(pen: Pen) {
  const idMap: Record<string, string> = {};
  const id = s8();
  if (pen.id) {
    idMap[pen.id] = id;
  }
  pen.id = id;

  if (Array.isArray(pen.anchors)) {
    for (const pt of pen.anchors) {
      if (pt.id) {
        const id = s8();
        idMap[pt.id] = id;
        pt.id = id;
      }
    }
  }

  return idMap;
}

export function makePensId(pens: Pen[]) {
  // 保留原有返回格式供外部调用兼容；拓扑引用不能使用混合了图元、锚点 ID 的映射。
  const idMap: Record<string, string> = {};
  const penIds = new Map<string, string>();
  const anchorIdsByPen = new Map<string, Map<string, string>>();
  const anchorsByPen = new Map<string, Map<string, Point>>();
  const copies: { pen: Pen; anchorIds: Map<string, string> }[] = [];
  for (const pen of pens) {
    const oldPenId = pen.id;
    const oldAnchorIds = Array.isArray(pen.anchors) ? pen.anchors.map((anchor) => anchor.id) : [];
    if (oldPenId && Array.isArray(pen.anchors)) {
      const anchors = new Map<string, Point>();
      for (const anchor of pen.anchors) {
        if (anchor.id) {
          anchors.set(anchor.id, anchor);
        }
      }
      anchorsByPen.set(oldPenId, anchors);
    }
    Object.assign(idMap, makePenId(pen));
    const anchorIds = new Map<string, string>();
    oldAnchorIds.forEach((id, index) => {
      if (id) {
        anchorIds.set(id, pen.anchors[index].id);
      }
    });
    if (oldPenId) {
      penIds.set(oldPenId, pen.id);
      // 默认锚点 ID（如 "0"、"1"）会在多个图元中重复，必须按旧图元 ID 隔离。
      anchorIdsByPen.set(oldPenId, anchorIds);
    }
    copies.push({ pen, anchorIds });
  }

  // 所有新 ID 分配完成后，再改写引用，避免被图元排列顺序影响。
  for (const { pen, anchorIds } of copies) {
    if (pen.parentId) {
      const parentId = penIds.get(pen.parentId);
      if (parentId) {
        pen.parentId = parentId;
      } else {
        delete pen.parentId;
      }
    }
    if (pen.children) {
      pen.children = pen.children
        .filter((id) => penIds.has(id))
        .map((id) => penIds.get(id))
        .filter((id): id is string => !!id);
    }

    if (Array.isArray(pen.anchors)) {
      for (const pt of pen.anchors) {
        const connectedPen = penIds.get(pt.connectedPen);
        const connectedAnchor = anchorIdsByPen.get(pt.connectedPen)?.get(pt.connectedAnchor);
        if (pt.id && connectedPen && connectedAnchor) {
          pt.connectedPen = connectedPen;
          pt.connectedAnchor = connectedAnchor;
        } else {
          // 未复制连接对象或锚点已失效时，成对清除连接字段，避免复制品连到原图元。
          delete pt.connectedPen;
          delete pt.connectedAnchor;
        }
      }
    }

    if (pen.connectedLines) {
      const connectedLines: NonNullable<Pen['connectedLines']> = [];
      for (const connection of pen.connectedLines) {
        const penId = penIds.get(connection.penId);
        const penAnchor = anchorIdsByPen.get(connection.penId)?.get(connection.penAnchor);
        const anchor = anchorIds.get(connection.anchor);
        if (penId && penAnchor && anchor) {
          connectedLines.push({ ...connection, penId, penAnchor, anchor });
        } else if (!anchor) {
          // 当前图元的锚点已不存在时，连线端点也不能保留单边连接。
          const targetAnchor = anchorsByPen.get(connection.penId)?.get(connection.penAnchor);
          if (targetAnchor) {
            delete targetAnchor.connectedPen;
            delete targetAnchor.connectedAnchor;
          }
        }
      }
      pen.connectedLines = connectedLines;
    }
  }

  return idMap;
}

export function getAllChildren(penMap: Map<string, Pen>, pen: Pen): Pen[] {
  const pens: Pen[] = [];

  if (pen.children) {
    for (const id of pen.children) {
      const child = penMap.get(id);
      if (child) {
        pens.push(child);
        pens.push(...getAllChildren(penMap, child));
      }
    }
  }

  return pens;
}

/**
 * pens 连同它们的全部子孙。按 id 去重：pens 里同时有父图元和它的子孙时，子孙只出现一次
 * （复制时重复的图元会各分到一个新 id，多出来的那份就成了孤儿）。
 */
export function getAllPens(penMap: Map<string, Pen>, pens: Pen[]): Pen[] {
  const allPens: Pen[] = [];
  const seen = new Set<string>();
  const push = (pen: Pen) => {
    if (!seen.has(pen.id)) {
      seen.add(pen.id);
      allPens.push(pen);
    }
  };

  for (const p of pens) {
    const pen = penMap.get(p.id);
    push(pen);
    if (pen.children) {
      for (const id of pen.children) {
        const child = penMap.get(id);
        if (child) {
          push(child);
          getAllChildren(penMap, child).forEach(push);
        }
      }
    }
  }

  return allPens;
}

export function translatePen(
  penMap: Map<string, Pen>,
  pen: Pen,
  offsetX: number,
  offsetY: number,
  beforeUpdate?: Pen[],
  update?: Pen[],
  patchFlag?: PatchFlag
) {
  if (beforeUpdate) {
    beforeUpdate.push(
      patchClone(pen, { parentId: pen.parentId, container: pen.container, textBox: pen.textBox, patchFlag })
    );
  }

  translateRect(pen, offsetX, offsetY);
  if (pen.textBox) {
    translateRect(pen.textBox, offsetX, offsetY);
  }
  update?.push(patchClone(pen, { parentId: pen.parentId, textBox: pen.textBox, container: pen.container, patchFlag }));

  if (pen.children) {
    pen.children.forEach((id) => {
      const child = penMap.get(id);
      translatePen(penMap, child, offsetX, offsetY, beforeUpdate, update, patchFlag);
    });
  }
}

export function rotatePen(
  penMap: Map<string, Pen>,
  pen: Pen,
  angle: number,
  pivot: Point,
  beforeUpdate?: Pen[],
  update?: Pen[],
  patchFlag?: PatchFlag
) {
  if (beforeUpdate) {
    beforeUpdate.push(patchClone(pen, { patchFlag }));
  }

  if (pen.category === PenCategory.Line) {
    if (pen.anchors) {
      pen.anchors.forEach((pt) => {
        rotatePoint(pt, angle, pivot);
      });
    }
  } else {
    if (pen.pivot.x === pivot.x && pen.pivot.y === pivot.y) {
      // 自身旋转，不用重计算区域
      pen.rotate += angle;
    } else {
      // 区域旋转，需要重计算边界坐标
      const { x, y } = pen;
      rotateRect(pen, angle, pivot);
      const dx = pen.x - x;
      const dy = pen.y - y;
      if (pen.anchors) {
        pen.anchors.forEach((pt) => {
          pt.x += dx;
          pt.y += dy;
        });
      }
      if (pen.textBox) {
        pen.textBox.x += dx;
        pen.textBox.ex += dx;
        pen.textBox.y += dy;
        pen.textBox.ey += dy;
      }
    }

    if (pen.rotate % 360 === 0) {
      pen.rotate = 0;
    }

    update?.push(patchClone(pen, { container: pen.container, patchFlag }));

    if (pen.children) {
      pen.children.forEach((id) => {
        const child = penMap.get(id);
        rotatePen(penMap, child, angle, pivot, beforeUpdate, update, patchFlag);
      });
    }
  }
}

/**
 * 围绕组合图元的中心翻转图元及其全部子孙。
 *
 * 组合图元本身不参与绘制，子图元保存的是画布绝对坐标，因此翻转组合时
 * 需要同时镜像子图元的位置、锚点和文字区域，不能只修改根节点的 flipX/flipY。
 * 连线的路径由 anchors 描述，翻转后直接镜像 anchors，避免再经过 flipRender
 * 导致路径被重复翻转；普通图元则通过切换自身翻转标记镜像内部图形。
 */
export function flipPen(
  penMap: Map<string, Pen>,
  pen: Pen,
  flipX: boolean,
  flipY: boolean,
  pivot: Point,
  beforeUpdate?: Pen[],
  update?: Pen[],
  patchFlag?: PatchFlag,
) {
  if (!pen) {
    return;
  }

  beforeUpdate?.push(patchClone(pen, { patchFlag }));

  const mirrorPoint = (point: Point) => {
    if (flipX) {
      point.x = 2 * pivot.x - point.x;
    }
    if (flipY) {
      point.y = 2 * pivot.y - point.y;
    }
  };
  const translatePoint = (point: Point, offsetX: number, offsetY: number) => {
    point.x += offsetX;
    point.y += offsetY;
  };

  const oldX = pen.x;
  const oldY = pen.y;

  // 子图元的矩形和旋转中心使用绝对坐标，需要统一镜像。
  if (flipX) {
    pen.x = 2 * pivot.x - pen.x - pen.width;
    pen.ex = pen.x + pen.width;
  }
  if (flipY) {
    pen.y = 2 * pivot.y - pen.y - pen.height;
    pen.ey = pen.y + pen.height;
  }
  pen.pivot && mirrorPoint(pen.pivot);
  const offsetX = pen.x - oldX;
  const offsetY = pen.y - oldY;
  if (pen.textBox) {
    // textBox 与普通图元一样保存翻转前的局部区域，翻转标记会在计算线程中
    // 再处理其镜像；这里只同步图元整体位移。
    translateRect(pen.textBox, offsetX, offsetY);
  }

  if (pen.anchors) {
    pen.anchors.forEach((anchor) => {
      if (pen.category === PenCategory.Line) {
        mirrorPoint(anchor);
        anchor.cp1 && mirrorPoint(anchor.cp1);
        anchor.cp2 && mirrorPoint(anchor.cp2);
      } else {
        // 普通图元的锚点保存翻转前坐标，翻转标记会在连接点计算时完成
        // 局部镜像，因此这里只跟随图元平移，避免重复镜像。
        translatePoint(anchor, offsetX, offsetY);
        anchor.cp1 && translatePoint(anchor.cp1, offsetX, offsetY);
        anchor.cp2 && translatePoint(anchor.cp2, offsetX, offsetY);
      }
    });
  }

  if (pen.category !== PenCategory.Line) {
    // 镜像会改变旋转方向；同时翻转两个轴等价于旋转 180 度，方向不变。
    if (flipX !== flipY && pen.rotate) {
      pen.rotate = -pen.rotate;
    }
    if (flipX) {
      pen.flipX = !pen.flipX;
    }
    if (flipY) {
      pen.flipY = !pen.flipY;
    }
  }

  update?.push(patchClone(pen, { container: pen.container, textBox: pen.textBox, patchFlag }));

  pen.children?.forEach((id) => {
    const child = penMap.get(id);
    if (child) {
      flipPen(penMap, child, flipX, flipY, pivot, beforeUpdate, update, patchFlag);
    }
  });
}

export function resizePen(
  penMap: Map<string, Pen>,
  activeBoundary: Rect,
  oldBoundary: Rect,
  pen: Pen,
  beforeUpdate?: Pen[],
  update?: Pen[],
  patchFlag?: PatchFlag
) {
  if (beforeUpdate) {
    beforeUpdate.push(patchClone(pen, { patchFlag }));
  }

  const oldPenRect = {
    x: pen.x,
    y: pen.y,
    width: pen.width,
    height: pen.height,
  };

  const scaleX = activeBoundary.width / oldBoundary.width;
  const scaleY = activeBoundary.height / oldBoundary.height;
  pen.flipX = scaleX < 0 !== !!pen.flipX;
  pen.flipY = scaleY < 0 !== !!pen.flipY;

  const oldCenter = {
    x: pen.x + pen.width / 2,
    y: pen.y + pen.height / 2,
  };

  const angle = pen.rotate || 0;
  const rad = (angle * Math.PI) / 180;

  const oldBoundaryCenter = {
    x: oldBoundary.x + oldBoundary.width / 2,
    y: oldBoundary.y + oldBoundary.height / 2,
  };
  const newBoundaryCenter = {
    x: activeBoundary.x + activeBoundary.width / 2,
    y: activeBoundary.y + activeBoundary.height / 2,
  };

  const dx = oldCenter.x - oldBoundaryCenter.x;
  const dy = oldCenter.y - oldBoundaryCenter.y;

  const [localX, localY] = new Vector2D(dx, dy).rotate(-rad).toArray();

  const scaledLocalX = localX * scaleX;
  const scaledLocalY = localY * scaleY;

  const [newDx, newDy] = new Vector2D(scaledLocalX, scaledLocalY).rotate(rad).toArray();

  const newCenter = {
    x: newBoundaryCenter.x + newDx,
    y: newBoundaryCenter.y + newDy,
  };

  pen.width *= Math.abs(scaleX);
  pen.height *= Math.abs(scaleY);

  pen.x = newCenter.x - pen.width / 2;
  pen.y = newCenter.y - pen.height / 2;
  pen.ex = pen.x + pen.width;
  pen.ey = pen.y + pen.height;

  if (pen.anchors) {
    // 锚点保存的是图元未旋转前的绝对坐标，需要按图元自身的新旧矩形换算，不能直接使用选区的旋转缩放矩阵。
    pen.anchors.forEach((anchor) => resizeAnchor(anchor, oldPenRect, pen));
  }

  const pivotDx = pen.pivot.x - oldBoundaryCenter.x;
  const pivotDy = pen.pivot.y - oldBoundaryCenter.y;

  const [localPivotX, localPivotY] = new Vector2D(pivotDx, pivotDy).rotate(-rad).toArray();

  const scaledPivotX = localPivotX * scaleX;
  const scaledPivotY = localPivotY * scaleY;

  const [newPivotDx, newPivotDy] = new Vector2D(scaledPivotX, scaledPivotY).rotate(rad).toArray();

  pen.pivot.x = newBoundaryCenter.x + newPivotDx;
  pen.pivot.y = newBoundaryCenter.y + newPivotDy;

  update?.push(patchClone(pen, { container: pen.container, patchFlag }));

  if (pen.children) {
    for (const id of pen.children) {
      const child = penMap.get(id);
      if (child) {
        resizePen(penMap, activeBoundary, oldBoundary, child, beforeUpdate, update, patchFlag);
      }
    }
  }
}

function resizeAnchor(anchor: Point, oldRect: Rect, newRect: Rect) {
  resizeAnchorPoint(anchor, oldRect, newRect);
  anchor.cp1 && resizeAnchorPoint(anchor.cp1, oldRect, newRect);
  anchor.cp2 && resizeAnchorPoint(anchor.cp2, oldRect, newRect);
}

function resizeAnchorPoint(point: Point, oldRect: Rect, newRect: Rect) {
  point.x = oldRect.width
    ? newRect.x + ((point.x - oldRect.x) / oldRect.width) * newRect.width
    : point.x + newRect.x - oldRect.x;
  point.y = oldRect.height
    ? newRect.y + ((point.y - oldRect.y) / oldRect.height) * newRect.height
    : point.y + newRect.y - oldRect.y;

  // 图元尺寸变化后，旧的旋转绝对坐标已经失效，后续交互时再按需计算。
  delete point.absoluteX;
  delete point.absoluteY;
}

export function calcIconRect(
  pen: Pen,
  defaultWidth = Math.min(pen.width, pen.height),
  defaultHeight = defaultWidth,
): Rect {
  const width = pen.iconWidth || pen.iconSize || defaultWidth;
  const height = pen.iconHeight || pen.iconSize || defaultHeight;
  const align = pen.iconAlign || Align.Center;

  let x: number;
  if (pen.iconLeft != undefined) {
    x = pen.x + pen.iconLeft;
  } else if (align & Align.Right) {
    x = pen.ex - width;
  } else if (align & Align.Left) {
    x = pen.x;
  } else {
    x = pen.x + (pen.width - width) / 2;
  }

  let y: number;
  if (pen.iconTop != undefined) {
    y = pen.y + pen.iconTop;
  } else if (align & Align.Bottom) {
    y = pen.ey - height;
  } else if (align & Align.Top) {
    y = pen.y;
  } else {
    y = pen.y + (pen.height - height) / 2;
  }

  return {
    x,
    y,
    width,
    height,
    ex: x + width,
    ey: y + height,
  };
}

export function calcImageRect(pen: Pen, image: CanvasImageSource): Rect {
  const rect = {
    x: pen.x,
    y: pen.y,
    width: pen.width,
    height: pen.height,
    ex: pen.x + pen.width,
    ey: pen.y + pen.height,
  };

  if (!pen.imageRatio) {
    return rect;
  }

  const imageLike = image as {
    width?: number;
    height?: number;
  };
  const imageWidth = imageLike.width;
  const imageHeight = imageLike.height;
  if (!imageWidth || !imageHeight) {
    return rect;
  }

  const scale = Math.min(rect.width / imageWidth, rect.height / imageHeight);
  const ratioWidth = imageWidth * scale;
  const ratioHeight = imageHeight * scale;
  const x = rect.x + (rect.width - ratioWidth) / 2;
  const y = rect.y + (rect.height - ratioHeight) / 2;

  return {
    x,
    y,
    width: ratioWidth,
    height: ratioHeight,
    ex: x + ratioWidth,
    ey: y + ratioHeight,
  };
}

export function calcTextRect(pen: Pen) {
  const bounds = getTextLayoutBounds(pen);
  pen.textRectX = bounds.x;
  pen.textRectY = bounds.y;
}

export function calcTextLines(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, pen: Pen) {
  pen.textBox = { x: Infinity, y: Infinity, ex: -Infinity, ey: -Infinity };
  const letterSpacing = pen.letterSpacing || 0;
  const textWidth = getTextLayoutWidth(pen);
  const textHeight = getTextLayoutHeight(pen);

  // 保留图元原始文本，保留小数位只影响当前绘制结果，不能污染业务数据。
  let text = pen.text == undefined ? '' : String(pen.text);
  if (pen.keepDecimal != undefined && text.trim() !== '' && !isNaN(+text)) {
    text = (+text).toFixed(pen.keepDecimal);
  }

  const rowHeight = (pen.fontSize || 12) * (pen.lineHeight || 1.5);
  if (pen.textWrap === TextWrap.Nowrap) {
    pen.textRectHeight = rowHeight;
    const measuredWidth = measureTextWidth(ctx, text, letterSpacing);
    if (!textWidth || pen.ellipsis === false || measuredWidth <= textWidth) {
      pen.textRectWidth = measuredWidth;
      pen.textLines = [getTextLineItem(pen, text, measuredWidth, rowHeight)];

      return;
    }

    // 计算省略号文字
    const len = text.length;
    const split = Math.floor(textWidth / (pen.fontSize || 12)); // 先估算，再用真实字体宽度校正
    if (split < len) {
      for (let i = split; i <= len; i++) {
        const line = text.slice(0, i) + ellipsis;
        const lineWidth = measureTextWidth(ctx, line, letterSpacing);
        if (lineWidth > textWidth) {
          if (i > split) {
            const fallback = getTextEllipsis(ctx, text.slice(0, i - 1), textWidth, letterSpacing);
            pen.textRectWidth = fallback.textWidth;
            pen.textLines = [getTextLineItem(pen, fallback.line, fallback.textWidth, rowHeight)];
            return;
          }
          break;
        } else {
          pen.textLines = [getTextLineItem(pen, line, lineWidth, rowHeight)];
          pen.textRectWidth = lineWidth;
        }
      }
    }

    for (let i = split - 1; i >= 0; i--) {
      const line = text.slice(0, i) + ellipsis;
      const lineWidth = measureTextWidth(ctx, line, letterSpacing);
      if (lineWidth <= textWidth) {
        pen.textRectWidth = lineWidth;
        pen.textLines = [getTextLineItem(pen, line, lineWidth, rowHeight)];
        return;
      }
    }

    pen.textRectWidth = measureTextWidth(ctx, ellipsis, letterSpacing);
    pen.textLines = [getTextLineItem(pen, ellipsis, pen.textRectWidth, rowHeight)];
    return;
  }

  const lines = text.split(/[\n]/g);
  let wrapLines: string[] = [];
  let wrapLineWidths: number[] = [];
  if (textWidth > 0 && pen.textWrap !== TextWrap.Line) {
    for (const line of lines) {
      const linesAndWidths = wrapLineByWord(ctx, line, textWidth, letterSpacing);
      wrapLines.push(...linesAndWidths.lines);
      wrapLineWidths.push(...linesAndWidths.textWidths);
    }
  } else {
    // 显式换行必须保留空行，且始终提前计算行宽，避免省略逻辑访问未初始化数组。
    wrapLines = lines;
    wrapLineWidths = lines.map((line) => measureTextWidth(ctx, line, letterSpacing));
  }

  if (textWidth > 0 && textHeight > 0) {
    const calcRows = Math.floor(textHeight / rowHeight);
    const maxRows = calcRows > 1 ? calcRows : 1;
    if (pen.ellipsis !== false && wrapLines.length > maxRows) {
      wrapLines = wrapLines.slice(0, maxRows);
      wrapLineWidths = wrapLineWidths.slice(0, maxRows);
      const lineInfo = getTextEllipsis(ctx, wrapLines[maxRows - 1], textWidth, letterSpacing);
      wrapLines[maxRows - 1] = lineInfo.line;
      wrapLineWidths[maxRows - 1] = lineInfo.textWidth;
    }
  }

  if (textWidth > 0) {
    pen.textRectWidth = textWidth;
  }

  pen.textRectHeight = wrapLines.length * rowHeight;

  pen.textLines = [];
  for (let i = 0; i < wrapLines.length; i++) {
    const lineWidth = wrapLineWidths[i] ?? measureTextWidth(ctx, wrapLines[i], letterSpacing);
    const item = getTextLineItem(pen, wrapLines[i], lineWidth, rowHeight, i);
    pen.textLines.push(item);
    if (pen.textRectWidth < lineWidth || !pen.textRectWidth) {
      pen.textRectWidth = lineWidth;
    }
  }
}

function getTextLineItem(pen: Pen, text: string, textWidth: number, rowHeight: number, i = 0) {
  // 计算文字绘画坐标
  let x = pen.textRectX;
  const width = getTextLayoutWidth(pen) || pen.width;
  if (!pen.textAlign || pen.textAlign === TextAlign.Center) {
    x = pen.textRectX + (width - textWidth) / 2;
  } else if (pen.textAlign === TextAlign.Right) {
    x = pen.textRectX + (width - textWidth);
  }

  let y = pen.textRectY + i * rowHeight - 0.5;
  let textHeight = pen.textHeight || pen.height;
  // 计算文字垂直对齐偏移量
  if (!pen.textVertical || pen.textVertical === TextVertical.Middle) {
    y += (textHeight - pen.textRectHeight) / 2;
  } else if (pen.textVertical === TextVertical.Bottom) {
    y += textHeight - pen.textRectHeight;
  }

  const ex = x + textWidth;
  const ey = y + rowHeight;

  if (x < pen.textBox.x) {
    pen.textBox.x = x;
  }
  if (y < pen.textBox.y) {
    pen.textBox.y = y;
  }
  if (ex > pen.textBox.ex) {
    pen.textBox.ex = ex;
  }
  if (ey > pen.textBox.ey) {
    pen.textBox.ey = ey;
  }

  return { text, x, y, textWidth, textHeight: rowHeight, ex };
}

function getTextEllipsis(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  width: number,
  letterSpacing = 0
) {
  for (let i = text.length; i > -1; --i) {
    const line = text.slice(0, i) + ellipsis;
    const textWidth = measureTextWidth(ctx, line, letterSpacing);
    if (textWidth <= width) {
      return { line, textWidth };
    }
  }

  const textWidth = measureTextWidth(ctx, ellipsis, letterSpacing);
  return { line: ellipsis, textWidth };
}

function measureTextWidth(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  letterSpacing = 0,
) {
  return ctx.measureText(text).width + text.length * letterSpacing;
}

function wrapLineByWord(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  line: string,
  width: number,
  letterSpacing = 0
) {
  if (!line) {
    return { lines: [''], textWidths: [0] };
  }

  const lines: string[] = [];
  const textWidths: number[] = [];
  const words = getWords(line);
  let current = '';
  const pushCurrent = () => {
    if (current) {
      lines.push(current);
      textWidths.push(measureTextWidth(ctx, current, letterSpacing));
      current = '';
    }
  };

  for (const word of words) {
    const wordWidth = measureTextWidth(ctx, word, letterSpacing);
    if (width <= 0 || wordWidth <= width) {
      const candidate = current + word;
      if (!current || measureTextWidth(ctx, candidate, letterSpacing) <= width) {
        current = candidate;
      } else {
        pushCurrent();
        current = word;
      }
      continue;
    }

    // 单个英文单词比文本框还宽时，逐字符兜底，不能把整个单词静默丢掉。
    pushCurrent();
    const split = wrapLineByAll(ctx, word, width, letterSpacing);
    lines.push(...split.lines.slice(0, -1));
    textWidths.push(...split.textWidths.slice(0, -1));
    current = split.lines[split.lines.length - 1] || '';
  }

  if (current || !lines.length) {
    lines.push(current);
    textWidths.push(measureTextWidth(ctx, current, letterSpacing));
  }

  return { lines, textWidths };
}

function wrapLineByAll(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  line: string,
  width: number,
  letterSpacing = 0,
) {
  const lines: string[] = [];
  const textWidths: number[] = [];
  if (!line) {
    return { lines: [''], textWidths: [0] };
  }
  if (width <= 0) {
    return { lines: [line], textWidths: [measureTextWidth(ctx, line, letterSpacing)] };
  }

  let current = '';
  for (const char of line) {
    const candidate = current + char;
    if (!current || measureTextWidth(ctx, candidate, letterSpacing) <= width) {
      current = candidate;
    } else {
      lines.push(current);
      textWidths.push(measureTextWidth(ctx, current, letterSpacing));
      current = char;
    }
  }

  if (current) {
    lines.push(current);
    textWidths.push(measureTextWidth(ctx, current, letterSpacing));
  }

  return { lines, textWidths };
}

/** 文字（含输入框）是否允许撑出图元边界：文字图元和连线按内容自然尺寸，其余形状受边界约束。 */
export function isTextOverflowAllowed(pen: Pen) {
  return pen.type === 'text' || pen.category === PenCategory.Line;
}

/** 计算文字区域，避免把百分比配置原地换算后在重复布局时累乘。 */
export function getTextLayoutBounds(pen: Pen) {
  const unit = !!pen.textUnit;
  const widthScale = unit ? pen.width : 1;
  const heightScale = unit ? pen.height : 1;
  const left = pen.textLeft == undefined ? 0 : pen.textLeft * widthScale;
  const right = pen.textRight == undefined ? 0 : pen.textRight * widthScale;
  const top = pen.textTop == undefined ? 0 : pen.textTop * heightScale;
  const bottom = pen.textBottom == undefined ? 0 : pen.textBottom * heightScale;
  const innerWidth = Math.max(0, pen.width - left - right);
  const innerHeight = Math.max(0, pen.height - top - bottom);
  const overflowAllowed = isTextOverflowAllowed(pen);

  let width: number | undefined;
  if (pen.textLeft != undefined && pen.textRight != undefined) {
    width = innerWidth;
  } else if (pen.textWidth != undefined) {
    width = unit ? pen.textWidth * pen.width : pen.textWidth;
  } else if (!overflowAllowed) {
    width = innerWidth;
  }
  if (!overflowAllowed && width != undefined) {
    width = Math.min(Math.max(0, width), innerWidth);
  }

  let height: number | undefined;
  if (pen.textTop != undefined && pen.textBottom != undefined) {
    height = innerHeight;
  } else if (pen.textHeight != undefined) {
    height = unit ? pen.textHeight * pen.height : pen.textHeight;
  } else if (!overflowAllowed) {
    height = innerHeight;
  }

  let x = left;
  if (pen.textLeft == undefined && pen.textRight != undefined && width != undefined) {
    x = pen.width - right - width;
  } else if (pen.textLeft == undefined && pen.textRight == undefined && width != undefined) {
    switch (pen.textAlign || TextAlign.Center) {
      case TextAlign.Right:
        x = pen.width - width;
        break;
      case TextAlign.Center:
        x = (pen.width - width) / 2;
        break;
    }
  }

  let y = top;
  if (pen.textTop == undefined && pen.textBottom != undefined && height != undefined) {
    y = pen.height - bottom - height;
  } else if (pen.textTop == undefined && pen.textBottom == undefined && height != undefined) {
    switch (pen.textVertical || TextVertical.Middle) {
      case TextVertical.Bottom:
        y = pen.height - height;
        break;
      case TextVertical.Middle:
        y = (pen.height - height) / 2;
        break;
    }
  }

  return {
    x: pen.x + x,
    y: pen.y + y,
    width,
    height,
  };
}

export function getTextLayoutWidth(pen: Pen) {
  return getTextLayoutBounds(pen).width;
}

export function getTextLayoutHeight(pen: Pen) {
  return getTextLayoutBounds(pen).height;
}

function getWords(txt: string) {
  const words: string[] = [];
  let word = '';
  for (let i = 0; i < txt.length; ++i) {
    const ch = txt.charCodeAt(i);
    if (ch < 33 || ch > 126) {
      if (word) {
        words.push(word);
        word = '';
      }
      words.push(txt[i]);
    } else {
      word += txt[i];
    }
  }

  if (word) {
    words.push(word);
  }

  return words;
}

function getWordLens(txt: string) {
  const words: number[] = [];
  let word = '';
  for (let i = 0; i < txt.length; ++i) {
    const ch = txt.charCodeAt(i);
    if (ch < 33 || ch > 126) {
      if (word) {
        words.push(word.length);
        word = '';
      }
      words.push(txt[i].length);
    } else {
      word += txt[i];
    }
  }

  if (word) {
    words.push(word.length);
  }

  return words;
}

/**
 * 判断图元的有效可见状态（考虑父图元的影响）
 */
export function isEffectiveVisible(pen: Pen, penMap: Map<string, Pen>): boolean {
  if (pen.visible === false) {
    return false;
  }

  if (pen.parentId) {
    const parent = penMap.get(pen.parentId);
    if (parent) {
      return isEffectiveVisible(parent, penMap);
    }
  }

  return true;
}

export function isEffectiveShowChild(pen: Pen, penMap: Map<string, Pen>): boolean {
  // 逐级检查祖先选择的分支；直接父级展示全部时，仍可能被更上层的 showChild 隐藏。
  while (pen.parentId) {
    const parent = penMap.get(pen.parentId);
    if (!parent) {
      break;
    }
    if (parent.showChild !== undefined && parent.children?.[parent.showChild] !== pen.id) {
      return false;
    }
    pen = parent;
  }

  return true;
}

export function updateNodeLines(penMap: Map<string, Pen>, node: Pen): Pen[] {
  const lines: Pen[] = [];

  return lines;
}

/**
 * 获取锚点在画布中的实际坐标。
 * 图元锚点保存的是翻转、旋转前坐标，连线端点必须使用最终显示坐标。
 */
export function getPenAnchorPosition(pen: Pen, anchor: Point): Point {
  const point = structuredClone(anchor);

  if (pen.flipX) {
    point.x = pen.x + pen.ex - point.x;
  }
  if (pen.flipY) {
    point.y = pen.y + pen.ey - point.y;
  }
  if (pen.rotate) {
    rotatePoint(
      point,
      pen.rotate,
      pen.pivot || {
        x: pen.x + pen.width / 2,
        y: pen.y + pen.height / 2,
      },
    );
  }

  return point;
}

/** 根据最新图元位置更新连线；正交线会丢弃旧中间折点并重新路由。 */
export function updateConnectedLine(line: Pen, nodeMap: Map<string, Pen>): Pen {
  if (!line?.anchors?.length) {
    return line;
  }

  for (const lineAnchor of line.anchors) {
    if (!lineAnchor.connectedPen || !lineAnchor.connectedAnchor) {
      continue;
    }

    const node = nodeMap.get(lineAnchor.connectedPen);
    const nodeAnchor = node?.anchors?.find((anchor) => anchor.id === lineAnchor.connectedAnchor);
    if (!node || !nodeAnchor) {
      continue;
    }

    const point = getPenAnchorPosition(node, nodeAnchor);
    lineAnchor.x = point.x;
    lineAnchor.y = point.y;
  }

  if (line.type === 'orthogonal' && line.anchors.length >= 2) {
    const from = structuredClone(line.anchors[0]);
    const to = structuredClone(line.anchors[line.anchors.length - 1]);
    const fromNode = from.connectedPen ? nodeMap.get(from.connectedPen) : undefined;

    // 正交算法会根据起点所属图元的边界和端点方向生成出线段。
    if (fromNode) {
      from.host = {
        x: fromNode.x,
        y: fromNode.y,
        ex: fromNode.ex,
        ey: fromNode.ey,
      };
    }
    if (from.direction === undefined && fromNode) {
      from.direction = getDirection(
        { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 },
        from,
      );
    }

    const routedPoints = getOrthogonalPoint(from, to);
    const last = routedPoints[routedPoints.length - 1] || from;
    if (last.id !== to.id) {
      // 极短连线可能被正交算法省略终点；已连接端点必须保留，必要时补一个直角折点。
      if (last.x !== to.x && last.y !== to.y) {
        routedPoints.push({ id: s8(), x: last.x, y: to.y });
      }
      routedPoints.push(to);
    }
    line.anchors = simplifyOrthogonalPoints([from, ...routedPoints]);
    for (const anchor of line.anchors) {
      delete anchor.host;
      delete anchor.temp;
    }
  }

  if (line.type === 'mind' && line.anchors.length >= 2) {
    // mind 语义上只有起终两点，兼容清理旧数据或异常交互留下的中间锚点。
    if (line.anchors.length > 2) {
      line.anchors = [line.anchors[0], line.anchors[line.anchors.length - 1]];
    }
    const from = line.anchors[0];
    const fromNode = from.connectedPen ? nodeMap.get(from.connectedPen) : undefined;
    updateMindControlPoints(line, fromNode);
  }

  calcLineRect(line);

  return line;
}

/** 按 1.0 mind 连线规则生成首尾三阶贝塞尔控制点。 */
export function updateMindControlPoints(line: Pen, fromNode?: Pen) {
  if (!line?.anchors || line.anchors.length < 2) {
    return;
  }

  const from = line.anchors[0];
  const to = line.anchors[line.anchors.length - 1];
  let direction = Direction.None;
  const fromNodeAnchor = fromNode?.anchors?.find((anchor) => anchor.id === from.connectedAnchor);

  if (from.direction !== undefined && from.direction !== Direction.None) {
    direction = from.direction;
  } else if (fromNodeAnchor?.direction !== undefined && fromNodeAnchor.direction !== Direction.None) {
    direction = fromNodeAnchor.direction;
  } else if (fromNode) {
    // 与 1.0 facePoint 一样，选择偏移量较大的轴；平局按上下方向处理。
    const dx = from.x - (fromNode.x + fromNode.width / 2);
    const dy = from.y - (fromNode.y + fromNode.height / 2);
    direction = Math.abs(dx) > Math.abs(dy)
      ? dx > 0 ? Direction.Right : Direction.Left
      : dy > 0 ? Direction.Bottom : Direction.Up;
  }

  // 未连接起点时与 1.0 保持一致：只按终点相对位置选择左右出线方向。
  if (direction === Direction.None) {
    direction = to.x > from.x ? Direction.Right : Direction.Left;
  }

  const cp1: Point = { x: from.x, y: from.y };
  const cp2: Point = { x: to.x, y: to.y };
  switch (direction) {
    case Direction.Up:
      cp1.y -= 20;
      cp2.y = from.y;
      break;
    case Direction.Bottom:
      cp1.y += 20;
      cp2.y = from.y;
      break;
    case Direction.Left:
      cp1.x -= 20;
      cp2.x = from.x;
      break;
    default:
      cp1.x += 20;
      cp2.x = from.x;
      break;
  }

  from.cp1 = cp1;
  to.cp2 = cp2;
}

/** 更新多条连线，供主线程提交和 Hover Worker 预览共同调用。 */
export function updateConnectedLines(lines: Pen[], nodes: Pen[]): Pen[] {
  const nodeMap = new Map<string, Pen>();
  for (const node of nodes || []) {
    node?.id && nodeMap.set(node.id, node);
  }

  for (const line of lines || []) {
    updateConnectedLine(line, nodeMap);
  }
  return lines;
}

/** 将连线子文字重新定位到有效路径段。 */
export function updateLineTextPosition(line: Pen, text: Pen): Pen {
  if (!line?.anchors || line.anchors.length < 2 || !text) {
    return text;
  }

  const segment = Math.max(0, Math.min(text.segment || 0, line.anchors.length - 2));
  const point = getSegmentPointByPosition(
    line.anchors.slice(segment, segment + 2),
    text.position ?? 0,
  );
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return text;
  }

  const x = Math.round(point.x - text.width / 2);
  const y = Math.round(point.y - text.height / 2);
  const offsetX = x - text.x;
  const offsetY = y - text.y;
  text.segment = segment;
  translateRect(text, offsetX, offsetY);

  if (text.textRectX !== undefined) {
    text.textRectX += offsetX;
  }
  if (text.textRectY !== undefined) {
    text.textRectY += offsetY;
  }
  text.textLines?.forEach((item) => translateRect(item, offsetX, offsetY));
  text._rect && translateRect(text._rect, offsetX, offsetY);

  return text;
}
