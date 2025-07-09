import {
  ctxFlip,
  ctxRotate,
  drawImage,
  Pen,
  setGlobalAlpha,
  getParent,
  renderPen,
  CanvasLayer,
} from '../pen';
import { Meta2dStore } from '../store';
import { rgba } from '../utils';
import { createOffscreen } from './offscreen';

export class CanvasTemplate {
  canvas = document.createElement('canvas');
  offscreen = createOffscreen();
  bgOffscreen = createOffscreen();
  patchFlags: boolean;
  bgPatchFlags: boolean;
  fit: boolean; //是否自适应布局
  constructor(public parentElement: HTMLElement, public store: Meta2dStore) {
    parentElement.appendChild(this.canvas);
    this.canvas.style.backgroundRepeat = 'no-repeat';
    this.canvas.style.backgroundSize = '100% 100%';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
  }

  resize(w?: number, h?: number) {
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    w = (w * this.store.dpiRatio) | 0;
    h = (h * this.store.dpiRatio) | 0;

    this.canvas.width = w;
    this.canvas.height = h;

    this.bgOffscreen.width = w;
    this.bgOffscreen.height = h;

    this.offscreen.width = w;
    this.offscreen.height = h;

    this.bgOffscreen
      .getContext('2d')
      .scale(this.store.dpiRatio, this.store.dpiRatio);
    this.bgOffscreen.getContext('2d').textBaseline = 'middle';

    this.offscreen
      .getContext('2d')
      .scale(this.store.dpiRatio, this.store.dpiRatio);
    this.offscreen.getContext('2d').textBaseline = 'middle';

    this.init();
  }

  init() {
    this.bgOffscreen
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.offscreen
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.patchFlags = true;
    this.bgPatchFlags = true;

    // for (const pen of this.store.data.pens) {
    //   if (this.hasImage(pen)) {
    //     // 只影响本层的
    //     pen.calculative.imageDrawed = false;
    //   }
    // }
    // this.store.patchFlagsBackground = true;
    // this.store.patchFlagsTop = true;
  }

  hidden() {
    this.canvas.style.display = 'none';
  }

  show() {
    this.canvas.style.display = 'block';
  }

  clear() {
    this.bgOffscreen
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.offscreen
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.bgPatchFlags = true;
    this.patchFlags = true;
  }

  render() {
    if (this.bgPatchFlags) {
      const ctx = this.bgOffscreen.getContext('2d');
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const width = this.store.data.width || this.store.options.width;
      const height = this.store.data.height || this.store.options.height;
      const x = this.store.data.x || this.store.options.x || 0;
      const y = this.store.data.y || this.store.options.y || 0;
      const background =  this.store.data.background || this.store.styles.background;
      // this.store.data.background || this.store.options.background;
      if (background) {
        ctx.save();
        ctx.fillStyle = background;
        ctx.globalAlpha = this.store.data.globalAlpha ?? this.store.options.globalAlpha;
        if (width && height&& !this.fit) {
          ctx.shadowOffsetX = this.store.options.shadowOffsetX;
          ctx.shadowOffsetY = this.store.options.shadowOffsetY;
          ctx.shadowBlur = this.store.options.shadowBlur;
          ctx.shadowColor = this.store.options.shadowColor;
          ctx.fillRect(
            this.store.data.origin.x + x,
            this.store.data.origin.y + y,
            width * this.store.data.scale,
            height * this.store.data.scale
          );
        } else {
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        ctx.restore();
      }
      if (width && height && this.store.bkImg) {
        ctx.save();
        if(this.fit){
          ctx.drawImage(this.store.bkImg,0, 0, this.canvas.offsetWidth, this.canvas.offsetHeight);
        }else{
          ctx.drawImage(
            this.store.bkImg,
            this.store.data.origin.x + x,
            this.store.data.origin.y + y,
            width * this.store.data.scale,
            height * this.store.data.scale
          );
        }
        ctx.restore();
      }
      this.renderGrid(ctx);
    }
    if (this.patchFlags) {
      const ctx = this.offscreen.getContext('2d') as CanvasRenderingContext2D;
      ctx.save();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.translate(this.store.data.x, this.store.data.y);
      for (const pen of this.store.data.pens) {
        if (!isFinite(pen.x)) {
          continue;
        }
        if (
          // pen.template
          pen.canvasLayer===CanvasLayer.CanvasTemplate
          && pen.calculative.inView) {
          // if (pen.name === 'combine' && !pen.draw){
          //   continue;
          // }
          //非图片
          renderPen(ctx, pen);
          //图片
          if (pen.image && pen.name !== 'gif' && pen.calculative.img) {
            ctx.save();
            ctxFlip(ctx, pen);
            if (pen.rotateByRoot || pen.calculative.rotate) {
              ctxRotate(ctx, pen);
            }

            setGlobalAlpha(ctx, pen);
            drawImage(ctx, pen);
            ctx.restore();
          }
        }
      }
      ctx.restore();
    }

    if (this.patchFlags || this.bgPatchFlags) {
      const ctxCanvas = this.canvas.getContext('2d');
      ctxCanvas.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctxCanvas.drawImage(
        this.bgOffscreen,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      ctxCanvas.drawImage(
        this.offscreen,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      this.patchFlags = false;
      this.bgPatchFlags = false;
    }
  }

  renderGrid(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ) {
    const { data, options } = this.store;
    const { grid, gridRotate, gridColor, gridSize, scale, origin } = data;
    if (!(grid ?? options.grid)) {
      // grid false 时不绘制, undefined 时看 options.grid
      return;
    }
    ctx.save();
    const width = (data.width || options.width) * scale;
    const height = (data.height || options.height) * scale;
    const startX = (data.x || options.x || 0) + origin.x;
    const startY = (data.y || options.y || 0) + origin.y;
    // if (width && height && gridRotate) {
    //   ctx.translate(width / 2, height / 2);
    //   ctx.rotate((gridRotate * Math.PI) / 180);
    //   ctx.translate(-width / 2, -height / 2);
    // }
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridColor || options.gridColor;
    ctx.beginPath();
    let size = (gridSize || options.gridSize) * scale;
    size = size < 0 ? 0 : size;
    if (!width || !height) {
      const ratio = this.store.dpiRatio;
      const cW = this.canvas.width / ratio;
      const cH = this.canvas.height / ratio;
      const m = startX / size;
      const n = startY / size;
      const offset = size * 10; //补偿值
      const newX = startX - Math.ceil(m) * size;
      const newY = startY - Math.ceil(n) * size;
      const endX = cW + newX + offset;
      const endY = cH + newY + offset;
      if (gridRotate) {
        // 菱形效果
        // drawParallelLines(ctx, cW, cH, size, gridRotate);
        // drawParallelLines(ctx, cW, cH, size, -gridRotate);

        // 计算两组斜线的方向向量
        const radian1 = (gridRotate * Math.PI) / 180;
        const radian2 = radian1 + Math.PI / 2;

        // 计算法向量用于间距控制
        const normal1 = { x: Math.sin(radian1), y: -Math.cos(radian1) };
        const normal2 = { x: Math.sin(radian2), y: -Math.cos(radian2) };
        drawPreciseLines(ctx, cW, cH, size, normal1, radian1);
        drawPreciseLines(ctx, cW, cH, size, normal2, radian2);
      } else {
        for (let i = newX; i <= endX; i += size) {
          ctx.moveTo(i, newY);
          ctx.lineTo(i, cH + newY + offset);
        }
        for (let i = newY; i <= endY; i += size) {
          ctx.moveTo(newX, i);
          ctx.lineTo(cW + newX + offset, i);
        }
      }
    } else {
      if(gridRotate){
        const radian1 = gridRotate * Math.PI / 180;
        const radian2 = radian1 + Math.PI / 2; // 垂直角度
        
        // 第一组斜线的法向量（用于间距控制）
        const normal1 = { 
            x: Math.sin(radian1), 
            y: -Math.cos(radian1) 
        };
        
        // 第二组斜线的法向量
        const normal2 = { 
            x: Math.sin(radian2), 
            y: -Math.cos(radian2) 
        };
        // 绘制第一组斜线
        drawPreciseLinesInRect(ctx, startX, startY, width, height, size, normal1, radian1);
        // 绘制第二组垂直斜线
        drawPreciseLinesInRect(ctx, startX, startY, width, height, size, normal2, radian1);
      }else{
        const endX = width + startX;
        const endY = height + startY;
        for (let i = startX; i <= endX; i += size) {
          ctx.moveTo(i, startY);
          ctx.lineTo(i, height + startY);
        }
        for (let i = startY; i <= endY; i += size) {
          ctx.moveTo(startX, i);
          ctx.lineTo(width + startX, i);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawParallelLines(ctx, width, height, spacing, angle) {
  const radian = (angle * Math.PI) / 180;
  const cos = Math.cos(radian);
  const sin = Math.sin(radian);

  const lineCount =
    Math.ceil(
      Math.max(width, height) /
        (spacing * Math.min(Math.abs(cos), Math.abs(sin)))
    ) * 2;

  ctx.beginPath();
  for (let i = -lineCount; i < lineCount; i++) {
    const x = i * spacing;
    if (sin > 0) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (height / sin) * cos, height);
    } else {
      ctx.moveTo(x, height);
      ctx.lineTo(x - (height / sin) * cos, 0);
    }
  }
  ctx.stroke();
}

function drawPreciseLines(ctx, width, height, spacing, normal, angle) {
  // 计算边界点
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  // 计算投影范围
  let minProjection = Infinity;
  let maxProjection = -Infinity;

  corners.forEach((corner) => {
    const proj = corner.x * normal.x + corner.y * normal.y;
    minProjection = Math.min(minProjection, proj);
    maxProjection = Math.max(maxProjection, proj);
  });

  // 计算线条数量
  const lineCount = Math.ceil((maxProjection - minProjection) / spacing);

  ctx.beginPath();
  for (let i = 0; i <= lineCount; i++) {
    const d = minProjection + i * spacing;

    // 计算与边界的交点
    let points = [];
    for (let j = 0; j < corners.length; j++) {
      const p1 = corners[j];
      const p2 = corners[(j + 1) % corners.length];

      const denom = normal.x * (p2.y - p1.y) - normal.y * (p2.x - p1.x);
      if (Math.abs(denom) > 1e-6) {
        const t =
          (d - p1.x * normal.x - p1.y * normal.y) /
          (normal.x * (p2.x - p1.x) + normal.y * (p2.y - p1.y));
        if (t >= 0 && t <= 1) {
          const x = p1.x + t * (p2.x - p1.x);
          const y = p1.y + t * (p2.y - p1.y);
          points.push({ x, y });
        }
      }
    }

    // 绘制线条（确保有2个交点）
    if (points.length >= 2) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
    }
  }
  ctx.stroke();
}

function drawPreciseLinesInRect(ctx, x, y, width, height, spacing, normal, angle) {
    const corners = [
        { x, y }, // 左上
        { x: x + width, y }, // 右上
        { x: x + width, y: y + height }, // 右下
        { x, y: y + height } // 左下
    ];
    
    // 1. 计算法向量在四个角上的投影范围
    let min = Infinity, max = -Infinity;
    corners.forEach(p => {
        const proj = p.x * normal.x + p.y * normal.y;
        min = Math.min(min, proj);
        max = Math.max(max, proj);
    });
    
    // 2. 计算需要绘制的线条数量和起始位置
    const totalLength = max - min;
    const lineCount = Math.ceil(totalLength / spacing);
    const startOffset = min;
    
    // 3. 绘制每条斜线
    ctx.beginPath();
    for (let i = 0; i <= lineCount; i++) {
        const d = startOffset + i * spacing;
        
        // 计算与矩形边的交点
        const points = [];
        for (let j = 0; j < corners.length; j++) {
            const p1 = corners[j];
            const p2 = corners[(j + 1) % 4];
            
            // 线段与斜线的交点计算
            const edgeVecX = p2.x - p1.x;
            const edgeVecY = p2.y - p1.y;
            
            const denominator = normal.x * edgeVecY - normal.y * edgeVecX;
            if (Math.abs(denominator) > 1e-6) {
                const t = (d - p1.x * normal.x - p1.y * normal.y) / 
                         (normal.x * edgeVecX + normal.y * edgeVecY);
                
                if (t >= 0 && t <= 1) {
                    points.push({
                        x: p1.x + t * edgeVecX,
                        y: p1.y + t * edgeVecY
                    });
                }
            }
        }
        
        // 连接交点（确保有2个交点）
        if (points.length >= 2) {
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
        }
    }
    ctx.stroke();
}