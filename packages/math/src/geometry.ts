/**
 * @meta2d/math —— 2D 几何基础：仿射矩阵、包围盒、曲线（椭圆弧、凸度圆弧、NURBS、Catmull-Rom）。
 *
 * 零依赖、纯函数，core 和各格式解析器（@meta2d/dxf、@meta2d/visio）共用，可在 Worker / Node 中运行。
 *
 * 矩阵约定：Matrix = [a, b, c, d, e, f]，与 Canvas `transform(a, b, c, d, e, f)`、SVG `matrix()` 同序：
 *   x' = a·x + c·y + e，y' = b·x + d·y + f
 * 可直接序列化进图纸 JSON、传给渲染器，不需要转换。
 */

/** 2D 仿射矩阵 */
export type Matrix = [number, number, number, number, number, number];

/** 轴对齐矩形 */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TAU = Math.PI * 2;
const EPS = 1e-9;

// ---------------------------------------------------------------------------
// 矩阵
// ---------------------------------------------------------------------------

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m1 · m2：先应用 m2，再应用 m1 */
export function multiplyMatrix(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function translateMatrix(x: number, y: number): Matrix {
  return [1, 0, 0, 1, x, y];
}

export function scaleMatrix(sx: number, sy = sx): Matrix {
  return [sx, 0, 0, sy, 0, 0];
}

export function rotateMatrix(rad: number): Matrix {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
}

/** 依次应用 ms[0]、ms[1] …（数组顺序即变换顺序） */
export function composeMatrix(...ms: Matrix[]): Matrix {
  let r = IDENTITY;
  for (const m of ms) {
    r = multiplyMatrix(m, r);
  }
  return r;
}

/** 逆矩阵；不可逆（行列式接近 0）时返回 undefined */
export function invertMatrix(m: Matrix): Matrix | undefined {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return undefined;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/** 只变换方向（忽略平移），用于向量、偏移量 */
export function applyMatrixToVector(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y, m[1] * x + m[3] * y];
}

/** 绕原点旋转向量（弧度，Y 向下坐标系中正值顺时针） */
export function rotateVector(x: number, y: number, rad: number): [number, number] {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [x * c - y * s, x * s + y * c];
}

export function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function isIdentity(m: Matrix) {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
}

/** 等比相似变换（旋转 + 等比缩放 + 可选镜像）：圆、椭圆、文字可以解析式地变换，不必离散 */
export function isSimilarity(m: Matrix) {
  const [a, b, c, d] = m;
  const s1 = a * a + b * b;
  const s2 = c * c + d * d;
  const tol = 1e-6 * Math.max(s1, s2, 1);
  return Math.abs(a * c + b * d) <= tol && Math.abs(s1 - s2) <= tol;
}

/** 平均缩放系数（线宽、字高等标量的换算） */
export function matrixScale(m: Matrix) {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || Math.hypot(m[0], m[1]) || 1;
}

/** 将包围盒按矩阵变换后取外接盒 */
export function transformBox(m: Matrix, box: Box): Box {
  if (isIdentity(m)) {
    return { ...box };
  }
  const acc = new BoxAccumulator();
  acc.add(...applyMatrix(m, box.x, box.y));
  acc.add(...applyMatrix(m, box.x + box.width, box.y));
  acc.add(...applyMatrix(m, box.x, box.y + box.height));
  acc.add(...applyMatrix(m, box.x + box.width, box.y + box.height));
  return acc.box();
}

// ---------------------------------------------------------------------------
// 包围盒
// ---------------------------------------------------------------------------

export class BoxAccumulator {
  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;

  add(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    x < this.minX && (this.minX = x);
    x > this.maxX && (this.maxX = x);
    y < this.minY && (this.minY = y);
    y > this.maxY && (this.maxY = y);
  }

  addBox(box: Box) {
    if (!box) {
      return;
    }
    this.add(box.x, box.y);
    this.add(box.x + box.width, box.y + box.height);
  }

  get empty() {
    return this.minX > this.maxX;
  }

  box(): Box {
    if (this.empty) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return { x: this.minX, y: this.minY, width: this.maxX - this.minX, height: this.maxY - this.minY };
  }
}

/** 三次贝塞尔在 [0,1] 内的极值参数（一维） */
export function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const ts: number[] = [];
  if (Math.abs(a) < EPS) {
    if (Math.abs(b) > EPS) {
      ts.push(-c / b);
    }
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      ts.push((-b + sq) / (2 * a), (-b - sq) / (2 * a));
    }
  }
  return ts.filter((t) => t > 0 && t < 1);
}

export function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number) {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

/** 角 a 是否落在从 start 出发、按方向扫到 end 的弧上 */
export function angleOnArc(a: number, start: number, end: number, anticlockwise: boolean) {
  if (anticlockwise) {
    [start, end] = [end, start];
  }
  const span = normalizeSweep(end - start);
  return normalizeSweep(a - start) <= span + 1e-12;
}

export function normalizeSweep(a: number) {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}

/**
 * Canvas 的 ellipse 实际扫过的角度（带符号）。规则与规范一致：
 * 顺时针（角度递增）时，end-start ≥ 2π 画整圆，否则取 (0, 2π) 内的等价值；逆时针同理。
 */
export function ellipseSweep(start: number, end: number, anticlockwise: boolean) {
  const delta = end - start;
  if (!anticlockwise) {
    if (delta >= TAU) return TAU;
    const s = normalizeSweep(delta);
    return s === 0 && delta !== 0 ? TAU : s;
  }
  if (-delta >= TAU) return -TAU;
  const s = normalizeSweep(-delta);
  return -(s === 0 && delta !== 0 ? TAU : s);
}

// ---------------------------------------------------------------------------
// 椭圆 / 圆弧
// ---------------------------------------------------------------------------

/**
 * 椭圆弧转三次贝塞尔（每段不超过 90°）。用于非等比变换：椭圆经过任意仿射变换后参数难以解析求出，
 * 但贝塞尔控制点可以直接逐点变换。
 * @returns 起点 + 若干 [c1x, c1y, c2x, c2y, x, y]
 */
export function ellipseToCubics(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot: number,
  start: number,
  end: number,
  anticlockwise: boolean,
): { start: [number, number]; curves: number[][] } {
  const sweep = ellipseSweep(start, end, anticlockwise);
  const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
  const step = sweep / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const map = (px: number, py: number): [number, number] => [cx + px * cos - py * sin, cy + px * sin + py * cos];
  const curves: number[][] = [];
  let t = start;
  for (let i = 0; i < n; i++) {
    const t2 = t + step;
    const c1 = Math.cos(t);
    const s1 = Math.sin(t);
    const c2 = Math.cos(t2);
    const s2 = Math.sin(t2);
    curves.push([
      ...map(rx * (c1 - k * s1), ry * (s1 + k * c1)),
      ...map(rx * (c2 + k * s2), ry * (s2 - k * c2)),
      ...map(rx * c2, ry * s2),
    ]);
    t = t2;
  }
  return { start: map(rx * Math.cos(start), ry * Math.sin(start)), curves };
}

/**
 * 由凸度（bulge，CAD 多段线顶点属性）求圆弧。bulge = tan(圆心角/4)，正值表示**角度递增方向**
 * （CAD 的 Y 轴向上坐标系里即逆时针）。
 */
export function bulgeToArc(x1: number, y1: number, x2: number, y2: number, bulge: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const k = (1 - bulge * bulge) / (4 * bulge);
  const cx = (x1 + x2) / 2 - k * dy;
  const cy = (y1 + y2) / 2 + k * dx;
  const r = Math.hypot(x1 - cx, y1 - cy);
  return {
    cx,
    cy,
    r,
    start: Math.atan2(y1 - cy, x1 - cx),
    end: Math.atan2(y2 - cy, x2 - cx),
    /** 角度递减方向 */
    decreasing: bulge < 0,
  };
}

/** 三点定圆（Visio ArcTo / EllipticalArcTo 的变换后求解）。共线时返回 undefined */
export function circleFrom3Points(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
  const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(d) < 1e-12) {
    return undefined;
  }
  const s1 = x1 * x1 + y1 * y1;
  const s2 = x2 * x2 + y2 * y2;
  const s3 = x3 * x3 + y3 * y3;
  const cx = (s1 * (y2 - y3) + s2 * (y3 - y1) + s3 * (y1 - y2)) / d;
  const cy = (s1 * (x3 - x2) + s2 * (x1 - x3) + s3 * (x2 - x1)) / d;
  return { cx, cy, r: Math.hypot(x1 - cx, y1 - cy) };
}

// ---------------------------------------------------------------------------
// NURBS
// ---------------------------------------------------------------------------

export interface NurbsInput {
  degree: number;
  controlPoints: { x: number; y: number; weight?: number }[];
  knots?: number[];
  weights?: number[];
  /** 是否周期（闭合）曲线，仅用于没有节点向量时生成均匀节点 */
  closed?: boolean;
}

/** 生成开放均匀（clamped）节点向量 */
export function clampedKnots(n: number, degree: number) {
  const knots: number[] = [];
  const m = n + degree + 1;
  for (let i = 0; i < m; i++) {
    if (i <= degree) knots.push(0);
    else if (i >= m - degree - 1) knots.push(1);
    else knots.push((i - degree) / (n - degree));
  }
  return knots;
}

/**
 * NURBS 曲线采样为折线点（de Boor 算法，O(p²) 每点，替代 V1 递归求基函数的 O(2^p)）。
 * 采样数随控制点数自适应。
 */
export function sampleNurbs(input: NurbsInput, segmentsPerSpan = 8): [number, number][] {
  const pts = input.controlPoints;
  const n = pts.length;
  if (n < 2) {
    return pts.map((p) => [p.x, p.y]);
  }
  const p = Math.max(1, Math.min(input.degree || 3, n - 1));
  let knots = input.knots;
  if (!knots || knots.length !== n + p + 1) {
    knots = clampedKnots(n, p);
  }
  const w = pts.map((pt, i) => input.weights?.[i] ?? pt.weight ?? 1);
  const t0 = knots[p];
  const t1 = knots[n];
  if (!(t1 > t0)) {
    return pts.map((pt) => [pt.x, pt.y]);
  }

  const evalAt = (t: number): [number, number] => {
    // 找区间 k：knots[k] <= t < knots[k+1]
    let k = p;
    while (k < n - 1 && t >= knots[k + 1]) k++;
    const dx: number[] = [];
    const dy: number[] = [];
    const dw: number[] = [];
    for (let j = 0; j <= p; j++) {
      const idx = k - p + j;
      dx[j] = pts[idx].x * w[idx];
      dy[j] = pts[idx].y * w[idx];
      dw[j] = w[idx];
    }
    for (let r = 1; r <= p; r++) {
      for (let j = p; j >= r; j--) {
        const idx = k - p + j;
        const denom = knots[idx + p - r + 1] - knots[idx];
        const alpha = denom === 0 ? 0 : (t - knots[idx]) / denom;
        dx[j] = (1 - alpha) * dx[j - 1] + alpha * dx[j];
        dy[j] = (1 - alpha) * dy[j - 1] + alpha * dy[j];
        dw[j] = (1 - alpha) * dw[j - 1] + alpha * dw[j];
      }
    }
    return [dx[p] / dw[p], dy[p] / dw[p]];
  };

  // 按非零区间分段采样，保证节点处的拐点被采到
  const out: [number, number][] = [];
  for (let k = p; k < n; k++) {
    const a = knots[k];
    const b = knots[k + 1];
    if (!(b > a)) continue;
    for (let s = 0; s < segmentsPerSpan; s++) {
      out.push(evalAt(a + ((b - a) * s) / segmentsPerSpan));
    }
  }
  out.push(evalAt(t1 - (t1 - t0) * 1e-9));
  const last = pts[n - 1];
  // clamped 曲线末端精确等于最后一个控制点
  if (knots[n] === knots[n + p] && Math.abs(w[n - 1]) > 0) {
    out[out.length - 1] = [last.x, last.y];
  }
  return out;
}

/** 过拟合点的 Catmull-Rom 曲线 → 三次贝塞尔（SPLINE 只有拟合点时使用） */
export function catmullRomToCubics(points: [number, number][], closed = false): number[][] {
  const out: number[][] = [];
  const n = points.length;
  if (n < 2) return out;
  const get = (i: number) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    out.push([
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    ]);
  }
  return out;
}

