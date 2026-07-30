import type {
  AnimationOptions,
  EasingName,
  PerspectiveOptions,
  ViewState,
} from "../../types";
import type { Meta2dLike } from "./store";

/** 无视角（初始状态） */
const IDENTITY_VIEW: ViewState = { x: 0, y: 0, z: 0, dist: 1000 };

/** 每个 meta2d 实例当前所处的视角（动画逐帧更新，保证连续切换视角时从当前状态起跳） */
const currentViewMap = new WeakMap<Meta2dLike, ViewState>();
/** 每个 meta2d 实例正在运行的动画取消函数 */
const cancelMap = new WeakMap<Meta2dLike, () => void>();

/** 获取实例当前视角（未变换过时为无视角状态） */
export function getCurrentView(meta2d: Meta2dLike): ViewState {
  return { ...(currentViewMap.get(meta2d) || IDENTITY_VIEW) };
}

/** 记录实例当前视角（直接变换 / 复位后同步调用） */
export function setCurrentView(
  meta2d: Meta2dLike,
  view: Partial<ViewState>
): void {
  currentViewMap.set(meta2d, { ...IDENTITY_VIEW, ...view });
}

/** 取消实例上正在运行的视角动画（若有） */
export function cancelTransformAnimation(meta2d: Meta2dLike): void {
  const cancel = cancelMap.get(meta2d);
  if (cancel) {
    cancelMap.delete(meta2d);
    cancel();
  }
}

const easings: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t * t,
  "ease-out": (t) => 1 - Math.pow(1 - t, 3),
  "ease-in-out": (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function raf(cb: () => void): number {
  return typeof requestAnimationFrame !== "undefined"
    ? requestAnimationFrame(cb)
    : (setTimeout(cb, 16) as unknown as number);
}

function cancelRaf(id: number): void {
  if (typeof cancelAnimationFrame !== "undefined") {
    cancelAnimationFrame(id);
  } else {
    clearTimeout(id);
  }
}

/** 从 options 中提取目标视角 */
export function targetViewOf(options: PerspectiveOptions): ViewState {
  return {
    x: options.x ?? 0,
    y: options.y ?? 0,
    z: options.z ?? 0,
    dist: options.dist ?? 1000,
  };
}

/**
 * 视角动画：从实例当前视角插值过渡到目标视角，逐帧调用 applyFrame。
 * 同一实例上新动画启动时会自动取消旧动画，并从当前帧所处视角继续过渡。
 *
 * @param meta2d Meta2d 实例
 * @param target 目标视角
 * @param animation 动画配置（true 使用默认配置）
 * @param applyFrame 每帧应用中间视角（内部应完成变换并渲染）
 */
export function runViewAnimation(
  meta2d: Meta2dLike,
  target: ViewState,
  animation: boolean | AnimationOptions,
  applyFrame: (view: ViewState) => void
): void {
  cancelTransformAnimation(meta2d);

  const opts: AnimationOptions = animation === true ? {} : animation || {};
  const duration = opts.duration ?? 500;
  const ease =
    typeof opts.easing === "function"
      ? opts.easing
      : easings[opts.easing || "ease-in-out"];

  const finish = () => {
    setCurrentView(meta2d, target);
    applyFrame(target);
    opts.onUpdate?.({ ...target });
    opts.onComplete?.();
  };

  if (duration <= 0) {
    finish();
    return;
  }

  const from = getCurrentView(meta2d);
  const start = now();
  let rafId = 0;
  let cancelled = false;

  cancelMap.set(meta2d, () => {
    cancelled = true;
    cancelRaf(rafId);
  });

  const tick = () => {
    if (cancelled) {
      return;
    }
    const t = Math.min(1, (now() - start) / duration);
    const k = ease(t);
    const view: ViewState = {
      x: from.x + (target.x - from.x) * k,
      y: from.y + (target.y - from.y) * k,
      z: from.z + (target.z - from.z) * k,
      dist: from.dist + (target.dist - from.dist) * k,
    };
    setCurrentView(meta2d, view);
    applyFrame(view);
    opts.onUpdate?.({ ...view });
    if (t < 1) {
      rafId = raf(tick);
    } else {
      cancelMap.delete(meta2d);
      opts.onComplete?.();
    }
  };

  tick();
}
