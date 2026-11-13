import type { VectorDocument, VectorGeom } from '@meta2d/drawir';
import { vectorDocumentToPens, type VectorConvertOptions, type VectorPensData } from './convert';

/** 视口：屏幕坐标 = 画布坐标 × scale + (x, y)，与 DrawIR 其他渲染后端的 Viewport 语义相同 */
export interface VectorViewport {
  scale: number;
  x: number;
  y: number;
}

export interface VectorRenderOptions extends VectorConvertOptions {
  /**
   * 渲染方式：
   * - `'open'`：作为新图纸打开，替换当前内容（缺省）
   * - `'append'`：追加到当前图纸，可撤销，不改变视图（除非显式 fit / viewport）
   */
  mode?: 'open' | 'append';
  /** 追加时是否记录撤销历史，缺省 true */
  history?: boolean;
  /** 显式视口，优先于 fit */
  viewport?: Partial<VectorViewport>;
  /** 让文档内容适配画布（open 时缺省 true） */
  fit?: boolean;
  /** fit 时的留白，缺省 20 */
  padding?: number;
}

/** 渲染器依赖的 Meta2d 实例方法（避免 models 反向依赖 Meta2d 类） */
export interface VectorRenderTarget {
  open(data?: any): void;
  addVectors(vectors: Record<string, VectorGeom>, broadcast?: boolean): void;
  addPens(pens: any[], mode?: number, parentId?: string): Promise<any>;
  fitView?(fitContent?: boolean | number, padding?: number): void;
  renderCanvas?: { clientWidth: number; clientHeight: number };
  clientWidth?: number;
  clientHeight?: number;
}

/** Mode.Edit：addPens 传入时记录撤销历史 */
const MODE_EDIT = 1;

/**
 * DrawIR 的 meta2d 2.x 渲染后端：把 Vector IR 文档转成 vector 图元后交给 Meta2d 实例绘制。
 *
 * 与 Canvas / SVG 后端不同，结果是可交互的图纸：图元可选中、移动、缩放、编辑，
 * 平移缩放由 meta2d 自己处理，`meta2d.data()` 保存时自动带上用到的共享几何。
 *
 * ```ts
 * const doc = await parseDxf(file);            // 任意 DrawIR 解析器的 VectorDocument
 * await new VectorRenderer(meta2d).render(doc); // 打开并适配视图
 * ```
 */
export class VectorRenderer {
  readonly name = 'meta2d';

  constructor(
    readonly meta2d: VectorRenderTarget,
    private defaults: VectorRenderOptions = {},
  ) {}

  async render(document: VectorDocument, options: VectorRenderOptions = {}): Promise<VectorPensData> {
    const opts: VectorRenderOptions = { ...this.defaults, ...options };
    const data = vectorDocumentToPens(document, opts);
    const m = this.meta2d;

    if ((opts.mode ?? 'open') === 'open') {
      // 视口随 open 一起下发：open 之后再 fitView 会有部分图元不重绘
      const v = opts.viewport
        ? { scale: 1, x: 0, y: 0, ...opts.viewport }
        : opts.fit !== false
          ? this.fitViewport(document, opts)
          : undefined;
      m.open({
        pens: data.pens,
        vectors: data.vectors,
        ...(data.background ? { background: data.background } : {}),
        ...(v || {}),
      });
    } else {
      // 先注册共享几何，再添加引用它们的图元
      m.addVectors(data.vectors);
      await m.addPens(data.pens, opts.history !== false ? MODE_EDIT : undefined);
      opts.fit && m.fitView?.(true, opts.padding ?? 20);
    }
    return data;
  }

  /** 文档内容（width/height 优先，否则 bbox）适配到画布的视口 */
  fitViewport(document: VectorDocument, opts: VectorRenderOptions = this.defaults): VectorViewport | undefined {
    const w = this.meta2d.renderCanvas?.clientWidth || this.meta2d.clientWidth;
    const h = this.meta2d.renderCanvas?.clientHeight || this.meta2d.clientHeight;
    if (!(w > 0) || !(h > 0)) return undefined;
    const k = opts.scale && opts.scale > 0 ? opts.scale : 1;
    const ox = opts.origin?.x ?? 0;
    const oy = opts.origin?.y ?? 0;
    const c =
      document.width && document.height ? { x: 0, y: 0, width: document.width, height: document.height } : document.bbox;
    if (!c) return undefined;
    const content = { x: ox + c.x * k, y: oy + c.y * k, width: c.width * k, height: c.height * k };
    const padding = opts.padding ?? 20;
    const scale = Math.min((w - padding * 2) / content.width, (h - padding * 2) / content.height);
    if (!(scale > 0) || !Number.isFinite(scale)) return undefined;
    return {
      scale,
      x: (w - content.width * scale) / 2 - content.x * scale,
      y: (h - content.height * scale) / 2 - content.y * scale,
    };
  }
}

/** 便捷函数：Vector IR 文档直接加载到 meta2d（缺省作为新图纸打开并适配视图） */
export function loadVectorDocument(meta2d: VectorRenderTarget, document: VectorDocument, options: VectorRenderOptions = {}) {
  return new VectorRenderer(meta2d).render(document, options);
}
