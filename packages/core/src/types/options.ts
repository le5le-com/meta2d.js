import { Point, Pen } from '../models';
import { RuleStyle } from './rule';
import { AnchorMode, Mode } from './state';

export type DrawingLineOptions = Partial<
  Pick<Pen, 'color' | 'lineWidth' | 'lineSmooth' | 'lineGradient' | 'fromArrow' | 'toArrow'>
>;

export interface Options {
  mode?: Mode;
  anchorMode?: AnchorMode;
  editPivot?: boolean; // 是否显示并编辑旋转支点
  hoverCursor?: string;
  minScale?: number;
  maxScale?: number;
  alignGrid?: boolean; // 自动对齐网格
  origin?: Point; // 标尺起点
  background?: string;
  grid?: {
    enable?: boolean;
    color?: string;
    size?: number;
  };
  rule?: {
    enable?: boolean;
    style?: RuleStyle; // 标尺样式
    color?: string;
    background?: string; // 背景颜色
    textColor?: string; // 文字颜色
    guidelineColor?: string;
  };
  scroll?: boolean;
  scaleOffset?: number;
  pencilTolerance?: number;
  ignoreHotkeys?: string[];
  clipboard?: boolean;
  /**
   * setValue（不带 render / mode）批量显示的最小发送间隔，ms。
   * 值到了就发，但两批之间至少隔这么久；上一批没画完时不发，攒着按 id 合并成下一批（只显示最新值）。
   * 0 = 不限间隔，数据一到尽快显示（只受画一批的速度约束）；调大则批次更大、CPU 更省。
   * 可随时用 setOptions 修改，下一批即生效。
   */
  patchQueueDelay?: number;
  performance?: boolean;
  perfProbe?: boolean; // 开启性能探针采集，配合 meta2d.getPerfReport() 使用
  /**
   * 关闭拾取的按帧合并（M9），退回「每个 mousemove 一次拾取」。
   *
   * 合并省了 43% 的拾取链路 CPU，但给 hover 重绘多加至多 1 帧延迟。这个开关存在的
   * 意义是让两者可以现场 A/B，判断这 1 帧在具体场景里值不值 —— 不是给生产用的。
   */
  disablePickCoalescing?: boolean;
  /**
   * 纯平移时整屏搬像素、只重画新暴露的那条 L 形窄带（M7a · PanBlit）。**默认开。**
   *
   * 关掉它就退回「每条 `UpdateView` 全量重绘」，同时保留全部 `view:*` 探针读数
   * （含 `view:blit:x4` 那个只在关掉时才有意义的批计时）—— 这个开关存在的意义
   * 是让快路径与全量路径可以现场 A/B，也是万一窄带出现残缺时的逃生门。
   *
   * 只在 render worker 内部生效；判定为非纯平移（缩放、`data` 其他字段变化、
   * 位移不足半像素、位移超过画布）时自动退回全量，见 `tryPanBlit`。
   */
  panBlit?: boolean;
  /**
   * 像素审计（M7a 第 5 步的**证据来源**）：接下来 N 条走了快路径的视口，各做一次
   * 「快路径画出来的像素 vs 慢路径基准」的逐像素比对，读数走 `audit:*`。**默认 0 = 关。**
   *
   * 为什么非要它：第 5 步要补的是 `inkBoxMin` 算不到的四类墨迹（rotate 外接圆、
   * `textBox` 外溢的文本、`shadowBlur/offset`、Line 端点箭头），而这四类**给不出
   * 正确性证明**，唯一的判据是像素。更要紧的是 D16 那一类缺陷（快路径 `restore()`
   * 把 CTM 一起退回）**在任何读数里都是正常的**，上次是靠肉眼发现的（结论 27）——
   * 这个开关就是把「只有眼睛能看见」变成一个数。
   *
   * 代价极大：每条审计要读两次整屏 `ImageData`（dpr=2 时 2×26.6MB）并重画一遍全量
   * ⇒ **只能按需开，且不要与任何性能采样同场跑**。审计自带修复：基准那一遍全量重绘
   * 留在屏上，所以即使快路径真的画错了，屏幕上留下的也是对的。
   */
  pixelAudit?: number;
  /** 像素审计的单通道容差 0~255，默认 0 = 严格相等。留给抗锯齿/亚像素噪声。 */
  pixelAuditTol?: number;
  /**
   * calc 里 `textBoxs` 的空间索引（第 5.16 步）。默认开。
   * - `false`：退回原来的全扫 —— **现场 A/B 用**：同一页里切换，排查问题是不是索引带来的。
   * - `'verify'`：照常走索引，但**每一次**查询都顺带跑原全扫逐项比对，不一致时在 worker 的
   *   控制台打印明细（与探针无关，手动点选 / 拖拽时也生效）。很慢，只在排查时开。
   */
  textBoxIndex?: boolean | 'verify';
  /**
   * M4 第 1 步：calc 把一帧里所有图元的动画更新合成**一条** RenderAnimation（`batch`）发出，默认开。
   * render 仍逐条按各自的区域重画（与原来逐条消息完全相同）；hover 把整批属性应用完只整屏重绘一次。
   * `false` 退回每个图元一条消息 —— 现场 A/B 与逃生门。
   */
  animBatch?: boolean;
  /**
   * M4 第 2 步：合批的一帧里，每帧只清空一次、只裁剪一次（400 个矩形放进同一条路径），
   * 每个图元只画一次（去重、按层级排序）。默认开（第四十六轮：5 帧与第三方参照 T 逐像素一致）；`false` 退回逐条绘制。
   */
  animMerge?: boolean;
  /**
   * 动画只算 / 只画视口里的：calc 跳过墨迹整个在视口外的播放器（节点动画仍把属性带给 render），
   * render 合并绘制时去掉画布外的块和图元（含 gif 换帧）。默认开；false 关掉，A/B 用。
   */
  animViewportCull?: boolean;
  /**
   * 合并绘制的逐像素审计：接下来 N 帧，先用原来的逐条路径画、截图，再恢复画布用合并路径画、截图，
   * 逐像素比对（audit:anim* 探针；不一致时 render worker 控制台打印）。每次显式设置重新装填预算。
   * 代价大（每帧三次 getImageData），只在验证时开。
   */
  animAudit?: number;
  /**
   * Patch 重绘的逐像素审计：接下来 N 次 Patch 重绘完成后，与「用 render 自己的几何扫全部图元、在新旧区域的并集里
   * 按当前状态按层级重画」的参照 T 比对（audit:patch* 探针；不一致时 render worker 控制台打印一行 JSON）。
   * 每次显式设置重新装填预算。代价大，只在排查时开。
   */
  patchAudit?: number;
  /** 只改属性的 Patch 在 render 里按帧合并绘制（默认开；false 退回逐条画，A/B 用） */
  patchCoalesce?: boolean;
  /** 散落图元的 Patch 按图元分块重画，而不是重画它们的并集框（默认开；false 退回并集框，A/B 用） */
  patchRegions?: boolean;
  /** 图元多时 open 先发视口里的、首屏画出来后再分批补其余的（默认开；false 一次发完） */
  progressiveLoad?: boolean;
  /** Patch 重画时跳过整块在画布外的脏区（默认开；false 关掉，A/B 用） */
  patchViewportCull?: boolean;
  /** 大批改动铺满视口时 render 直接整屏重画，calc 不再求脏区图元清单（默认开；false 关掉，A/B 用） */
  patchFullView?: boolean;
  /** 关掉缩放 / 旋转 mousemove 的按帧合并，退回逐事件处理（A/B 用） */
  disableHoverMoveCoalescing?: boolean;
  /** 探针开着时文本框索引每 32 次查询顺带全扫比对一次；false 关掉，量不含它的单价 */
  textShadowCheck?: boolean;
  /** 平移窄带选取先按「矩形 ± maxInkPad」粗筛（默认开；false 退回逐个算墨迹盒，A/B 用） */
  bandCoarse?: boolean;
  disableRotate?: boolean;
  disableSize?: boolean;

  /** 连线预设 */
  drawingLineOptions?: DrawingLineOptions;

  fromArrow?: string;
  toArrow?: string;
  animateInterval?: number;
  unknowBackground?: string;
  activeLineDash?: number[];
  hoverBoxColor?: string; // 控制器盒子颜色
  activeBoxColor?: string;
  color?: string;
  activeColor?: string;
  activeBackground?: string;
  hoverColor?: string;
  hoverBackground?: string;
  anchorColor?: string;
  hoverAnchorColor?: string;
  anchorRadius?: number;
  anchorBackground?: string;
  dockColor?: string;
  dragSelectionColor?: string;
  textColor?: string;
  fontFamily?: string;
  lineTextBackground?: string; // 连线文字背景色
  collaborateColors?: string[]; //多人协作成员调色板
}
