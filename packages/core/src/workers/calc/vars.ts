import { Pen } from '../../models';
import { Options } from '../../types';

export const options: Options = {};

export const penMap: Map<string, Pen> = new Map();
export const textBoxs = {};

/** 当前视口缩放，由 worker 在 Data / Option / TranslateScale 时同步；拾取要按屏幕像素算容差 */
export const view = { scale: 1 };

/**
 * 当前视口的世界坐标范围，由 worker 在视口相关消息后同步（syncViewWorld）。
 * 动画循环用它跳过墨迹整个在视口外的播放器（见 animate.ts 的 offView）。ok = false 时判不了，一律当在视口内。
 */
export const viewWorld = { ok: false, x0: 0, y0: 0, x1: 0, y1: 0 };

/** 画布级默认填充（data.penBackground / penGradient）：有它时基础形状都是实心的，由 onData 同步 */
export const paint = { penFill: false };
