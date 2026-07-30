import type { GridBackgroundOptions, Point } from "../../types";
import { Vector3D } from "../math";

function projectPoint(
  point: Point,
  options: GridBackgroundOptions
): Point & { visible?: boolean } {
  const center = options.center || {
    x: options.width / 2,
    y: options.height / 2,
  };
  const angleX = options.x ?? 0;
  const angleY = options.y ?? 0;
  const angleZ = options.z ?? 0;
  const dist = options.dist ?? 1000;

  let x = point.x - center.x;
  let y = point.y - center.y;
  const radX = (angleX * Math.PI) / 180;
  const radY = (angleY * Math.PI) / 180;
  const radZ = (angleZ * Math.PI) / 180;
  let vec = new Vector3D(x, y, 0);
  vec = vec.rotateX(radX).rotateY(radY).rotateZ(radZ);

  const near = dist * 0.1;
  const depth = dist + vec.z;
  if (depth < near) {
    return { ...point, visible: false };
  }
  const scale = dist / depth;
  return {
    ...point,
    x: vec.x * scale + center.x,
    y: vec.y * scale + center.y,
  };
}

function drawProjectedSegment(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  options: GridBackgroundOptions
) {
  const pa = projectPoint(a, options);
  const pb = projectPoint(b, options);
  if (pa.visible === false || pb.visible === false) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
}

/**
 * 生成与 transform 视角一致的透视网格背景图（返回 dataURL）
 */
export function createGridBackground(options: GridBackgroundOptions): string {
  const width = Math.max(1, Math.floor(options.width));
  const height = Math.max(1, Math.floor(options.height));
  const spacing = options.spacing ?? 60;
  const lineColor = options.lineColor ?? "rgba(140,170,230,0.35)";
  const lineWidth = options.lineWidth ?? 1;
  const background = options.background ?? "#060c22";
  const glow = options.glow !== false;
  const glowColor = options.glowColor ?? "rgba(80,120,200,0.55)";
  const vignette = options.vignette !== false;
  const center = options.center || { x: width / 2, y: height / 2 };

  const canvas =
    typeof document !== "undefined"
      ? document.createElement("canvas")
      : (null as unknown as HTMLCanvasElement);
  if (!canvas) {
    throw new Error("createGridBackground requires a DOM canvas environment");
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("createGridBackground: 2d context unavailable");
  }

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  if (glow) {
    const radius = Math.max(width, height) * 0.45;
    const grad = ctx.createRadialGradient(
      center.x,
      center.y,
      0,
      center.x,
      center.y,
      radius
    );
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 在世界坐标中铺一张足够大的网格，再按当前视角投影
  const extent = Math.max(width, height) * 2;
  const x0 = Math.floor((center.x - extent) / spacing) * spacing;
  const x1 = Math.ceil((center.x + extent) / spacing) * spacing;
  const y0 = Math.floor((center.y - extent) / spacing) * spacing;
  const y1 = Math.ceil((center.y + extent) / spacing) * spacing;

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "butt";

  for (let x = x0; x <= x1; x += spacing) {
    drawProjectedSegment(
      ctx,
      { x, y: y0 },
      { x, y: y1 },
      options
    );
  }
  for (let y = y0; y <= y1; y += spacing) {
    drawProjectedSegment(
      ctx,
      { x: x0, y },
      { x: x1, y },
      options
    );
  }
  ctx.restore();

  if (vignette) {
    const grad = ctx.createRadialGradient(
      center.x,
      center.y,
      Math.min(width, height) * 0.25,
      center.x,
      center.y,
      Math.max(width, height) * 0.75
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  return canvas.toDataURL("image/png");
}
