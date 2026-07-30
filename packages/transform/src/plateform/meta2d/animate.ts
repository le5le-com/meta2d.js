import type {
  AnimationOptions,
  EasingName,
  PerspectiveOptions,
  ViewState,
} from "../../types";
import type { Meta2dLike } from "./store";

const DEFAULT_VIEW: ViewState = { x: 0, y: 0, z: 0, dist: 1000 };

const currentViewMap = new WeakMap<Meta2dLike, ViewState>();
const rafMap = new WeakMap<Meta2dLike, number>();

function clamp01(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function resolveEasing(
  easing?: EasingName | ((t: number) => number)
): (t: number) => number {
  if (typeof easing === "function") {
    return easing;
  }
  switch (easing) {
    case "linear":
      return (t) => t;
    case "ease-in":
      return (t) => t * t;
    case "ease-out":
      return (t) => 1 - (1 - t) * (1 - t);
    case "ease-in-out":
    default:
      return (t) =>
        t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

function normalizeAnimation(
  animation: boolean | AnimationOptions
): AnimationOptions {
  return animation === true ? {} : animation || {};
}

/**
 * 从 PerspectiveOptions 提取目标视角（缺省角度 0、视距 1000）
 */
export function targetViewOf(options: PerspectiveOptions = {}): ViewState {
  return {
    x: options.x ?? 0,
    y: options.y ?? 0,
    z: options.z ?? 0,
    dist: options.dist ?? DEFAULT_VIEW.dist,
  };
}

/**
 * 读取当前视角；未设置过时返回默认视角
 */
export function getCurrentView(meta2d: Meta2dLike): ViewState {
  const cur = currentViewMap.get(meta2d);
  return cur ? { ...cur } : { ...DEFAULT_VIEW };
}

/**
 * 记录当前视角。传入空对象时重置为默认视角（用于 reset*）
 */
export function setCurrentView(
  meta2d: Meta2dLike,
  view: Partial<ViewState>
): void {
  if (!view || Object.keys(view).length === 0) {
    currentViewMap.set(meta2d, { ...DEFAULT_VIEW });
    return;
  }
  const base = currentViewMap.get(meta2d) || DEFAULT_VIEW;
  currentViewMap.set(meta2d, {
    x: view.x ?? base.x,
    y: view.y ?? base.y,
    z: view.z ?? base.z,
    dist: view.dist ?? base.dist,
  });
}

/**
 * 取消正在进行的视角动画
 */
export function cancelTransformAnimation(meta2d: Meta2dLike): void {
  const id = rafMap.get(meta2d);
  if (id != null) {
    cancelAnimationFrame(id);
    rafMap.delete(meta2d);
  }
}

/**
 * 从当前视角平滑过渡到目标视角，逐帧调用 applyFrame
 */
export function runViewAnimation(
  meta2d: Meta2dLike,
  target: ViewState,
  animation: boolean | AnimationOptions,
  applyFrame: (view: ViewState) => void
): void {
  cancelTransformAnimation(meta2d);

  const opts = normalizeAnimation(animation);
  const duration = Math.max(0, opts.duration ?? 500);
  const ease = resolveEasing(opts.easing ?? "ease-in-out");
  const from = getCurrentView(meta2d);

  if (duration === 0) {
    applyFrame(target);
    opts.onUpdate?.(target);
    setCurrentView(meta2d, target);
    opts.onComplete?.();
    return;
  }

  const start = performance.now();

  const tick = (now: number) => {
    const t = clamp01((now - start) / duration);
    const k = ease(t);
    const view: ViewState = {
      x: lerp(from.x, target.x, k),
      y: lerp(from.y, target.y, k),
      z: lerp(from.z, target.z, k),
      dist: lerp(from.dist, target.dist, k),
    };
    applyFrame(view);
    opts.onUpdate?.(view);

    if (t < 1) {
      rafMap.set(meta2d, requestAnimationFrame(tick));
      return;
    }

    rafMap.delete(meta2d);
    setCurrentView(meta2d, target);
    opts.onComplete?.();
  };

  rafMap.set(meta2d, requestAnimationFrame(tick));
}
