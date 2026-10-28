import { getSegmentPointByPosition, LineAnimation, Pen, Rect, LineAnimationType, Point } from '../../models';
import { PlayState, WorkerMessage } from '../../types';

let elementDraws: {
  [key: number]: (ctx: OffscreenCanvasRenderingContext2D, position: Rect, angle: number, size: number) => void;
} = {
  [LineAnimationType.Arrow]: drawArrow,
  [LineAnimationType.WaterDrop]: drawWaterDrop,
  [LineAnimationType.Image]: drawImage,
  [LineAnimationType.Icon]: drawIcon,
  [LineAnimationType.Element]: drawCodeElement,
};

function lineAnimationCommon(ctx: OffscreenCanvasRenderingContext2D, animation: LineAnimation) {
  ctx.strokeStyle = animation.color;
  ctx.lineWidth = animation.lineWidth || 1;
  // ctx.lineCap = 'round';
  // ctx.lineJoin = 'round';
  if (animation.shadow) {
    ctx.shadowColor = animation.shadowColor || animation.color;
    ctx.shadowBlur = animation.shadowBlur || 6;
  }
}

export function lineAnimationDefault(ctx: OffscreenCanvasRenderingContext2D, line: Pen, animation: LineAnimation) {
  lineAnimationCommon(ctx, animation);

  if (animation.reverse) {
    ctx.setLineDash([0, line.length - line.linePosition, line.linePosition]);
  } else {
    ctx.setLineDash([line.linePosition, line.length + 0.01]);
  }
}

export function lineAnimationBeads(ctx: OffscreenCanvasRenderingContext2D, line: Pen, animation: LineAnimation) {
  lineAnimationCommon(ctx, animation);

  if (animation.reverse) {
    ctx.lineDashOffset = line.linePosition;
  } else {
    ctx.lineDashOffset = line.length - line.linePosition;
  }
  let dash = [5, 10];
  if (animation.lineDash) {
    if (Array.isArray(animation.lineDash)) {
      dash = animation.lineDash;
    } else {
      dash = animation.lineDash.split(',').map(Number);
    }
  }
  dash = dash.map((item) => item * (animation.lineWidth || 1));
  ctx.setLineDash(dash);
}

export function lineAnimationDot(ctx: OffscreenCanvasRenderingContext2D, line: Pen, animation: LineAnimation) {
  lineAnimationCommon(ctx, animation);

  if (animation.reverse) {
    ctx.lineDashOffset = line.linePosition;
  } else {
    ctx.lineDashOffset = line.length - line.linePosition;
  }
  ctx.setLineDash([0.1, line.length]);
}

export function lineAnimationArrow(ctx: OffscreenCanvasRenderingContext2D, line: Pen, animation: LineAnimation) {
  loopDrawElementOnLine(ctx, line, animation);
}

export function lineAnimationWaterDrop(ctx: OffscreenCanvasRenderingContext2D, line: Pen, animation: LineAnimation) {
  loopDrawElementOnLine(ctx, line, animation);
}

export function lineAnimationImage(
  ctx: OffscreenCanvasRenderingContext2D,
  line: Pen,
  animation: LineAnimation,
  elem?: HTMLImageElement,
) {
  loopDrawElementOnLine(ctx, line, animation, elem);
}

export function lineAnimationIcon(ctx: OffscreenCanvasRenderingContext2D, line: Pen, animation: LineAnimation) {
  loopDrawElementOnLine(ctx, line, animation);
}

export function lineAnimationElement(ctx: OffscreenCanvasRenderingContext2D, line: Pen, animation: LineAnimation) {
  loopDrawElementOnLine(ctx, line, animation);
}

export function lineAnimationPen(ctx: OffscreenCanvasRenderingContext2D, line: Pen, animation: LineAnimation) {
  loopDrawElementOnLine(ctx, line, animation);
}

function loopDrawElementOnLine(
  ctx: OffscreenCanvasRenderingContext2D,
  line: Pen,
  animation: LineAnimation,
  elem?: HTMLImageElement,
) {
  let markerSpacing = animation.markerSpacing || 100;
  let markerCount = Math.floor(line.length / markerSpacing);
  let markerOffset: number;
  if (animation.reverse) {
    markerOffset = (line.length - line.linePosition) % markerSpacing;
  } else {
    markerOffset = line.linePosition % markerSpacing;
  }

  if (animation.type === LineAnimationType.Pen) {
    if (line.play !== PlayState.Playing) {
      return;
    }
    //获取位置
    let positions: Point[] = [];
    let angles: number[] = [];
    let arr = [];
    if (animation.lineDash) {
      if (Array.isArray(animation.lineDash)) {
        arr = animation.lineDash;
      } else {
        arr = animation.lineDash.split(',').map(Number);
      }
    }
    let currentLen = line.linePosition;
    if (animation.reverse) {
      currentLen = line.length - line.linePosition;
    }
    const { position, angle } = getPosition(line, currentLen);
    positions.push(position);
    angles.push(angle);
    for (let i = 0; i < arr.length; i++) {
      currentLen += arr[i];
      const { position, angle } = getPosition(line, currentLen);
      positions.push(position);
      angles.push(angle);
    }
    self.postMessage({
      action: WorkerMessage.UpdateAnimationElement,
      positions,
      angles,
      targetType: animation.targetType,
      target: animation.target,
      lineID: line.id,
    });

    return;
  }

  ctx.save();
  switch (animation.type) {
    case LineAnimationType.Arrow:
    case LineAnimationType.WaterDrop:
    case LineAnimationType.Element:
      lineAnimationCommon(ctx, animation);
      ctx.fillStyle = animation.color;
      break;
  }
  if (animation.count) {
    let arr = Array(animation.count - 1).fill(20);
    let currentLen = line.linePosition;
    if (animation.reverse) {
      currentLen = line.length - line.linePosition;
    }
    if (animation.lineDash) {
      if (Array.isArray(animation.lineDash)) {
        arr = animation.lineDash;
      } else {
        arr = animation.lineDash.split(',').map(Number);
      }
    }
    drawElement(ctx, line, animation, currentLen, elem); //绘制第一个
    for (let i = 0; i < animation.count - 1; i++) {
      currentLen += arr[i];
      drawElement(ctx, line, animation, currentLen, elem);
    }
  } else {
    for (let i = 0; i < markerCount; i++) {
      let currentLen = i * markerSpacing + markerOffset;
      if (currentLen + 2 >= line.length) {
        currentLen = line.length - 2;
      }
      drawElement(ctx, line, animation, currentLen, elem);
    }
  }
  ctx.restore();
}

function drawElement(
  ctx: OffscreenCanvasRenderingContext2D,
  line: Pen,
  animation: LineAnimation,
  currentLen: number,
  elem?: HTMLImageElement,
) {
  let position = getSegmentPointByPosition(line.anchors, currentLen);
  let last = getSegmentPointByPosition(line.anchors, currentLen - 2);
  let next = getSegmentPointByPosition(line.anchors, currentLen + 2);
  let angle = getTangentAngle([last, position, next]);
  if (animation.reverse) {
    angle += Math.PI;
  }
  if (animation.type === LineAnimationType.Image) {
    drawImage(ctx, position, angle, animation.lineWidth || 10, elem);
  } else if (animation.type === LineAnimationType.Icon) {
    drawIcon(ctx, position, angle, animation.lineWidth || 10, {
      iconFamily: animation.iconFamily,
      icon: animation.icon,
    });
  } else if (animation.type === LineAnimationType.Element) {
    drawCodeElement(ctx, position, angle, animation.lineWidth || 10);
  } else {
    elementDraws[animation.type](ctx, position, angle, animation.lineWidth || 10);
  }
}

function getPosition(line: Pen, currentLen: number) {
  let position = getSegmentPointByPosition(line.anchors, currentLen);
  let last = getSegmentPointByPosition(line.anchors, currentLen - 2);
  let next = getSegmentPointByPosition(line.anchors, currentLen + 2);
  let angle = getTangentAngle([last, position, next]);
  return { position, angle };
}

// 三点法获取切线角度
function getTangentAngle(points) {
  let p0 = points[0];
  let p1 = points[1];
  let p2 = points[2];

  const dx1 = p1.x - p0.x;
  const dy1 = p1.y - p0.y;
  const dx2 = p2.x - p1.x;
  const dy2 = p2.y - p1.y;

  const dx = (dx1 + dx2) / 2;
  const dy = (dy1 + dy2) / 2;

  let angle = Math.atan2(dy, dx);

  if (angle < 0) {
    angle += 2 * Math.PI;
  }

  return angle;
}

function drawArrow(ctx: OffscreenCanvasRenderingContext2D, position: Rect, angle: number, size: number) {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size / 2, size / 2);
  ctx.lineTo(-size / 4, 0);
  ctx.lineTo(-size / 2, -size / 2);
  ctx.closePath();

  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-size / 1.5, 0, size / 3, size / 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawWaterDrop(ctx: OffscreenCanvasRenderingContext2D, position: Rect, angle: number, size: number) {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, size / 4);
  ctx.arc(0, 0, size / 4, -Math.PI, Math.PI, false);
  ctx.moveTo(0, size / 4);
  ctx.lineTo(-size * 2, 0);
  ctx.lineTo(0, -size / 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawCodeElement(ctx: OffscreenCanvasRenderingContext2D, position: Rect, angle: number, size: number) {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);

  //TODO: 代码元素绘制
  ctx.restore();
}

function drawImage(
  ctx: OffscreenCanvasRenderingContext2D,
  position: Rect,
  angle: number,
  size: number,
  img?: HTMLImageElement,
) {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);
  const h = size;
  const w = (h * img.width) / img.height;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawIcon(ctx: OffscreenCanvasRenderingContext2D, position: Rect, angle: number, size: number, elem?: Pen) {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${size}px/ ${elem.iconFamily}`;
  ctx.fillText(elem.icon, 0, 0);
  ctx.restore();
}
