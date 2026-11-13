import {
  createGeom,
  type VectorDocument,
  type VectorGeom,
  type VectorItem,
  type VectorPathItem,
} from '@meta2d/drawir';
import { textItemToPen } from './editable';
import { penRectOfGeom } from './pen-rect';

/**
 * IR 文档 → meta2d 图元的粒度：
 * - `'item'`：每个顶层绘制项一个图元，可单独选中、移动、编辑（缺省）
 * - `'document'`：整份文档一个图元，适合只看不改的大图纸
 */
export type VectorGranularity = 'item' | 'document';

export interface VectorConvertOptions {
  granularity?: VectorGranularity;
  /** granularity 为 'item' 时，绘制项超过该数量自动改为 'document'（图元过多会拖慢拾取和撤销），缺省 20000 */
  maxPens?: number;
  /**
   * 可编辑模式（granularity 为 'item' 时生效，缺省 true）：
   * - 文字项转为原生文字图元（name: 'text'），双击即可修改；
   * - 单路径项的固定描边色 / 填充色 / 线宽提升到 pen.color / pen.background / pen.lineWidth，属性面板修改立即生效。
   */
  editable?: boolean;
  /** 文档坐标 → 画布坐标的缩放，缺省 1 */
  scale?: number;
  /** 文档原点在画布上的位置，缺省 { x: 0, y: 0 } */
  origin?: { x: number; y: number };
  /** 覆盖 doc.color（'$fg'）；都没有时跟随主题 / 图元颜色 */
  color?: string;
  /** 覆盖 doc.background（'$bg'），写入 pen.background */
  background?: string;
  /** 覆盖 doc.lineWidth（'$lw' 与最细线宽），写入 pen.lineWidth */
  lineWidth?: number;
  /** 覆盖 doc.lineDash，写入 pen.lineDash */
  lineDash?: number[];
  /** 固定颜色也统一使用前景色（pen.vectorTint） */
  tint?: boolean;
  /** 图元锁定状态（LockState），缺省不锁定 */
  locked?: number;
  /**
   * 共享几何 id 前缀。多次导入的文档可能使用相同的 id（如 dxf-1），
   * 追加到同一图纸时会互相覆盖，因此缺省为每次转换生成随机前缀；传 false 保留原 id。
   */
  namespace?: string | false;
  /** 写入每个图元的额外属性 */
  extra?: Record<string, any>;
}

/** 转换结果：可直接 meta2d.open(data)，或 addVectors(vectors) + addPens(pens) 追加 */
export interface VectorPensData {
  pens: any[];
  vectors: Record<string, VectorGeom>;
  background?: string;
  /** 实际使用的粒度（可能因 maxPens 自动降级） */
  granularity: VectorGranularity;
}

/** 固定颜色（不含 '$fg' / '$bg' / 'none' 和渐变）才能提升到图元属性 */
const isFixed = (c: unknown): c is string => typeof c === 'string' && !!c && c !== 'none' && c[0] !== '$';

function randomId() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Vector IR 文档（DrawIR）→ meta2d 1.x 数据（`name: 'vector'` 矢量图元 + 共享几何）。
 *
 * IR 本身与平台无关，'$fg' / '$bg' / '$lw' 由渲染后端解析。meta2d 后端的解析方式：
 * 绑定到图元的 color（随悬停、选中、主题变化）/ background / lineWidth，文档级缺省值写到图元上。
 *
 * 纯函数：不依赖 DOM 和 Meta2d 实例，可在 Worker 中运行。
 */
export function vectorDocumentToPens(doc: VectorDocument, options: VectorConvertOptions = {}): VectorPensData {
  const s = options.scale && options.scale > 0 ? options.scale : 1;
  const ox = options.origin?.x ?? 0;
  const oy = options.origin?.y ?? 0;
  const ns = options.namespace === false ? '' : options.namespace ?? `drawir-${randomId()}`;
  const penPrefix = ns || `drawir-${randomId()}`;
  const editable = options.editable !== false;
  const color = options.color ?? doc.color;
  const background = options.background !== undefined ? options.background || undefined : doc.background;
  const lineWidth = options.lineWidth ?? doc.lineWidth;
  const lineDash = options.lineDash ?? doc.lineDash;

  // 共享几何加命名空间，引用项同步改名
  const rename = (id: string) => (ns ? `${ns}:${id}` : id);
  const renameItems = (items: VectorItem[]): VectorItem[] =>
    ns ? items.map((it) => (it.t === 'r' ? { ...it, id: rename(it.id) } : it)) : items;
  const vectors: Record<string, VectorGeom> = {};
  for (const id in doc.vectors || {}) {
    const g = doc.vectors[id];
    vectors[rename(id)] = { bbox: g.bbox, items: renameItems(g.items) };
  }
  const resolve = (id: string) => vectors[id];

  // 是否用到 '$bg'（含引用的共享几何）：只有用到时才写 pen.background
  const bgCache = new Map<string, boolean>();
  const usesBg = (items: VectorItem[], depth = 0): boolean =>
    items.some((it) => {
      if (it.t === 'p') return it.s?.fill === '$bg' || it.s?.stroke === '$bg';
      if (it.t === 't') return it.fill === '$bg';
      if (it.t === 'h') return it.stroke === '$bg';
      if (it.t === 'i') return false;
      if (depth > 24) return false;
      if (!bgCache.has(it.id)) {
        bgCache.set(it.id, false);
        const def = resolve(it.id);
        bgCache.set(it.id, !!def && usesBg(def.items, depth + 1));
      }
      return bgCache.get(it.id);
    });

  const items = renameItems(doc.items || []);
  let granularity: VectorGranularity = options.granularity ?? 'item';
  if (granularity === 'item' && items.length > (options.maxPens ?? 20000)) granularity = 'document';

  let n = 0;
  const nextId = () => `${penPrefix}-${(n++).toString(36)}`;
  const finish = (pen: any) => {
    options.locked !== undefined && (pen.locked = options.locked);
    options.extra && Object.assign(pen, options.extra);
    return pen;
  };
  const vectorPen = (geomItems: VectorItem[]) => {
    const geom = createGeom(geomItems, resolve);
    const { bbox } = geom;
    if (!Number.isFinite(bbox.x) || !Number.isFinite(bbox.y) || !Number.isFinite(bbox.width)) return undefined;
    const r = penRectOfGeom(bbox);
    const pen: any = {
      id: nextId(),
      name: 'vector',
      x: ox + r.x * s,
      y: oy + r.y * s,
      width: r.width * s,
      height: r.height * s,
      vector: geom,
      // 矢量图元不显示锚点、不做连线吸附：图元数量大时默认锚点会让拾取很慢
      disableAnchor: true,
      anchors: [],
    };
    color && (pen.color = color);
    background && usesBg(geomItems) && (pen.background = background);
    lineWidth !== undefined && (pen.lineWidth = lineWidth);
    lineDash?.length && (pen.lineDash = lineDash);
    options.tint && (pen.vectorTint = true);
    return pen;
  };

  const pens: any[] = [];
  if (granularity === 'document') {
    const pen = vectorPen(items);
    pen && pens.push(finish(pen));
  } else {
    for (const item of items) {
      if (editable && item.t === 't') {
        if (!item.text || !(item.h > 0)) continue;
        pens.push(finish(placeText(textItemToPen(item, { id: nextId(), color }), item.h, s, ox, oy)));
        continue;
      }
      const geomItems = editable && item.t === 'p' ? [bindable(item)] : [item];
      const pen = vectorPen(geomItems);
      if (!pen) continue;
      editable && item.t === 'p' && bindStyle(pen, s, lineWidth);
      pens.push(finish(pen));
    }
  }

  const out: VectorPensData = { pens, vectors, granularity };
  background && (out.background = background);
  return out;
}

/** 复制路径项（bindStyle 会修改样式） */
function bindable(item: VectorPathItem): VectorPathItem {
  return item.s ? { ...item, s: { ...item.s } } : { ...item };
}

/**
 * 单路径图元：固定描边色 → pen.color，固定填充色 → pen.background（样式改为 '$bg'），
 * 几何线宽 → pen.lineWidth（样式改为 '$lw'），属性面板修改即可生效。
 */
function bindStyle(pen: any, s: number, docLineWidth: number | undefined) {
  const it = pen.vector.items[0] as VectorPathItem;
  const st = it.s || (it.s = {});
  if (isFixed(st.stroke)) {
    pen.color = st.stroke;
    delete st.stroke;
  }
  if (isFixed(st.fill)) {
    pen.background = st.fill;
    st.fill = '$bg';
  }
  if (st.stroke !== 'none') {
    if (typeof st.lw === 'number') {
      // pen.lineWidth 是画布单位，几何已按 s 缩放
      pen.lineWidth = st.lw * s;
      st.lw = '$lw';
    } else if (st.lw === '$lw') {
      pen.lineWidth = docLineWidth ?? 1;
    }
  }
  Object.keys(st).length || delete it.s;
}

/** 文档坐标中的文字图元 → 画布坐标 */
function placeText(pen: any, h: number, s: number, ox: number, oy: number) {
  pen.x = ox + pen.x * s;
  pen.y = oy + pen.y * s;
  pen.width *= s;
  pen.height *= s;
  const size = h * s;
  // 1.x 中 0 < fontSize < 1 表示「相对图元高度的比例」（textItemToPen 按缩放前的字高写过一次，这里按缩放后重算）
  pen.fontSize = size >= 1 || !(pen.height > 0) ? size : size / pen.height;
  return pen;
}
