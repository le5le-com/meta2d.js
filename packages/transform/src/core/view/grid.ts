import type { GridBackgroundOptions, Point } from "../../types";
import { perspectiveTransform } from "./index";

/** 解析 rgb(a)/hex 颜色并重设透明度，用于渐变端点 */
function withAlpha(color: string, alpha: number): string {
  const rgba = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)/
  );
  if (rgba) {
    return `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${alpha})`;
  }
  const hex = color.replace("#", "");
  if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) {
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

function createCanvas(width: number, height: number) {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement;
  }
  throw new Error("createGridBackground: 当前环境不支持 canvas");
}

/**
 * 根据当前视角生成伪 3D 背景网格图（dataURL base64）。
 * 网格线与图元共用同一个 perspectiveTransform，
 * 因此传入与 transformPens 相同的 x/y/z/dist/center 即可让背景网格
 * 与场景保持同一视角。
 *
 * @param options width/height 输出尺寸，x/y/z 旋转角度、视距 dist、
 *                环绕中心 center（缺省为画面中心），以及网格/背景样式
 * @returns dataURL（`data:image/png;base64,...`），可直接用作背景图
 */
export function createGridBackground(
  options: GridBackgroundOptions
): string {
  const {
    width,
    height,
    x = 0,
    y = 0,
    z = 0,
    dist = 1000,
    center,
    spacing = 60,
    lineColor = "rgba(140,170,230,0.35)",
    lineWidth = 1,
    background = "#060c22",
    glow = true,
    glowColor = "rgba(80,120,200,0.55)",
    glowRadius = 0.6,
    vignette = true,
    vignetteStart = 0.25,
    vignetteStrength = 0.97,
  } = options;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  if (!ctx) {
    throw new Error("createGridBackground: 无法获取 2d 上下文");
  }

  const c: Point = center || { x: width / 2, y: height / 2 };
  const radius = Math.max(width, height) * 0.75;

  // 底色
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // 中心光晕（收窄半径，让中心更亮、更集中）
  if (glow) {
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, radius * glowRadius);
    g.addColorStop(0, glowColor);
    g.addColorStop(1, withAlpha(glowColor, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  // 世界平面（z=0）上以 center 为中心的网格线，
  // 范围取对角线 + 视距，保证大倾角下仍铺满画面
  const extent = Math.hypot(width, height) + dist;
  const step = spacing / 2; // 采样步长，兼顾近裁剪面处的截断
  const lines: Point[][] = [];
  for (let i = -extent; i <= extent; i += spacing) {
    const row: Point[] = [];
    const col: Point[] = [];
    for (let j = -extent; j <= extent; j += step) {
      row.push({ x: c.x + j, y: c.y + i });
      col.push({ x: c.x + i, y: c.y + j });
    }
    lines.push(row, col);
  }

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  for (const line of lines) {
    const projected = perspectiveTransform(line, c, x, y, z, dist);
    ctx.beginPath();
    let drawing = false;
    for (const p of projected) {
      if ((p as any).visible === false || !p.scale) {
        drawing = false;
        continue;
      }
      if (drawing) {
        ctx.lineTo(p.x, p.y);
      } else {
        ctx.moveTo(p.x, p.y);
        drawing = true;
      }
    }
    ctx.stroke();
  }

  // 边缘压暗，让网格线向四周渐隐（与中心亮区形成明暗对比）
  if (vignette) {
    const v = ctx.createRadialGradient(
      c.x,
      c.y,
      radius * vignetteStart,
      c.x,
      c.y,
      radius
    );
    v.addColorStop(0, withAlpha(background, 0));
    v.addColorStop(0.6, withAlpha(background, vignetteStrength * 0.55));
    v.addColorStop(1, withAlpha(background, vignetteStrength));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, width, height);
  }

  return canvas.toDataURL("image/png");
}
