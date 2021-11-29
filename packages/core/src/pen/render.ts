import { Pen } from './model';
import { getSplitAnchor } from '../diagrams';
import { Direction } from '../data';
import { distance, facePoint, Point, rotatePoint, scalePoint, translatePoint } from '../point';
import { calcCenter, calcRelativePoint, Rect, scaleRect, translateRect } from '../rect';
import { globalStore, TopologyStore } from '../store';
import { calcTextLines } from './text';
import { deepClone } from '../utils/clone';
import { renderFromArrow, renderToArrow } from './arrow';
import { Flip, Gradient } from '@topology/core';

export function getParent(pen: Pen, root?: boolean) {
  if (!pen || !pen.parentId || !pen.calculative) {
    return undefined;
  }

  const store = pen.calculative.canvas.store;
  if (!root) {
    return store.pens[pen.parentId];
  }
  return getParent(store.pens[pen.parentId], root) || store.pens[pen.parentId];
}

export function getAllChildren(pen: Pen) {
  if (!pen || !pen.children || !pen.calculative) {
    return [];
  }
  const store = pen.calculative.canvas.store;
  const children: Pen[] = [];
  pen.children.forEach((id) => {
    children.push(store.pens[id]);
    children.push(...getAllChildren(store.pens[id]));
  });
  return children;
}

function drawBkLinearGradient(ctx: CanvasRenderingContext2D, pen: Pen) {
  return linearGradient(
    ctx,
    pen.calculative.worldRect,
    pen.calculative.gradientFromColor,
    pen.calculative.gradientToColor,
    pen.calculative.gradientAngle
  );
}

/**
 * 避免副作用，把创建好后的径向渐变对象返回出来
 * @param ctx 画布绘制对象
 * @param pen 当前画笔
 * @returns 径向渐变
 */
function drawBkRadialGradient(ctx: CanvasRenderingContext2D, pen: Pen) {
  if (!pen.calculative.gradientFromColor || !pen.calculative.gradientToColor) {
    return;
  }

  const { worldRect } = pen.calculative;
  let r = worldRect.width;
  if (r < worldRect.height) {
    r = worldRect.height;
  }
  r *= 0.5;
  !pen.calculative.gradientRadius && (pen.calculative.gradientRadius = 0);
  const grd = ctx.createRadialGradient(
    worldRect.center.x,
    worldRect.center.y,
    r * pen.calculative.gradientRadius,
    worldRect.center.x,
    worldRect.center.y,
    r
  );
  grd.addColorStop(0, pen.calculative.gradientFromColor);
  grd.addColorStop(1, pen.calculative.gradientToColor);

  return grd;
}

function strokeLinearGradient(ctx: CanvasRenderingContext2D, pen: Pen) {
  return linearGradient(
    ctx,
    pen.calculative.worldRect,
    pen.calculative.lineGradientFromColor,
    pen.calculative.lineGradientToColor,
    pen.calculative.lineGradientAngle
  );
}

/**
 * 避免副作用，把创建好后的线性渐变对象返回出来
 * @param ctx 画布绘制对象
 * @param worldRect 世界坐标
 * @returns 线性渐变
 */
function linearGradient(
  ctx: CanvasRenderingContext2D,
  worldRect: Rect,
  fromColor: string,
  toColor: string,
  angle: number
) {
  if (!fromColor || !toColor) {
    return;
  }

  const from: Point = {
    x: worldRect.x,
    y: worldRect.center.y,
  };
  const to: Point = {
    x: worldRect.ex,
    y: worldRect.center.y,
  };
  if (angle % 90 === 0 && angle % 180) {
    if (angle % 270) {
      from.x = worldRect.center.x;
      from.y = worldRect.y;
      to.x = worldRect.center.x;
      to.y = worldRect.ey;
    } else {
      from.x = worldRect.center.x;
      from.y = worldRect.ey;
      to.x = worldRect.center.x;
      to.y = worldRect.y;
    }
  } else if (angle) {
    rotatePoint(from, angle, worldRect.center);
    rotatePoint(to, angle, worldRect.center);
  }

  // contributor: https://github.com/sunnyguohua/topology
  const grd = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  grd.addColorStop(0, fromColor);
  grd.addColorStop(1, toColor);
  return grd;
}

export function renderPen(ctx: CanvasRenderingContext2D, pen: Pen) {
  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.beginPath();

  if (pen.calculative.flip) {
    if (pen.calculative.flip === Flip.Horizontal) {
      ctx.translate(pen.calculative.worldRect.x + pen.calculative.worldRect.ex + 0.5, 0.5);
      ctx.scale(-1, 1);
    } else if (pen.calculative.flip === Flip.Vertical) {
      ctx.translate(0.5, pen.calculative.worldRect.y + pen.calculative.worldRect.ey + 0.5);
      ctx.scale(1, -1);
    }
  }

  if (pen.calculative.rotate && pen.name !== 'line') {
    ctx.translate(pen.calculative.worldRect.center.x, pen.calculative.worldRect.center.y);
    let rotate = (pen.calculative.rotate * Math.PI) / 180;
    // 目前只有水平和垂直翻转，都需要 * -1
    pen.calculative.flip && (rotate *= -1);
    ctx.rotate(rotate);
    ctx.translate(-pen.calculative.worldRect.center.x, -pen.calculative.worldRect.center.y);
  }

  if (pen.calculative.lineWidth > 1) {
    ctx.lineWidth = pen.calculative.lineWidth;
  }

  const store = pen.calculative.canvas.store;

  let fill: any;
  if (pen.calculative.hover) {
    ctx.strokeStyle = pen.hoverColor || store.options.hoverColor;
    fill = pen.hoverBackground || store.options.hoverBackground || pen.calculative.background;
    ctx.fillStyle = fill;
  } else if (pen.calculative.active) {
    ctx.strokeStyle = pen.activeColor || store.options.activeColor;
    fill = pen.activeBackground || store.options.activeBackground || pen.calculative.background;
    ctx.fillStyle = fill;
  } else {
    if (pen.calculative.strokeImage) {
      if (pen.calculative.strokeImg) {
        ctx.strokeStyle = ctx.createPattern(pen.calculative.strokeImg, 'repeat');
        fill = true;
      }
    } else {
      let stroke: string | CanvasGradient | CanvasPattern;
      // TODO: 线只有线性渐变
      if (pen.calculative.strokeType === Gradient.Linear) {
        stroke = strokeLinearGradient(ctx, pen);
      } else {
        stroke = pen.calculative.color;
      }
      ctx.strokeStyle = stroke;
    }

    if (pen.calculative.backgroundImage) {
      if (pen.calculative.backgroundImg) {
        ctx.fillStyle = ctx.createPattern(pen.calculative.backgroundImg, 'repeat');
        fill = true;
      }
    } else {
      let back: string | CanvasGradient | CanvasPattern;
      if (pen.calculative.bkType === Gradient.Linear) {
        back = drawBkLinearGradient(ctx, pen);
      } else if (pen.calculative.bkType === Gradient.Radial) {
        back = drawBkRadialGradient(ctx, pen);
      } else {
        back = pen.calculative.background;
      }
      ctx.fillStyle = back;
      fill = !!back;
    }
  }

  if (pen.calculative.lineCap) {
    ctx.lineCap = pen.calculative.lineCap as CanvasLineCap;
  } else if (pen.type) {
    ctx.lineCap = 'round';
  }

  if (pen.calculative.lineJoin) {
    ctx.lineJoin = pen.calculative.lineJoin as CanvasLineJoin;
  } else if (pen.type) {
    ctx.lineJoin = 'round';
  }

  if (pen.calculative.globalAlpha < 1) {
    ctx.globalAlpha = pen.calculative.globalAlpha;
  }

  if (pen.calculative.lineDash) {
    ctx.setLineDash(pen.calculative.lineDash);
  }
  if (pen.calculative.lineDashOffset) {
    ctx.lineDashOffset = pen.calculative.lineDashOffset;
  }

  if (pen.calculative.shadowColor) {
    ctx.shadowColor = pen.calculative.shadowColor;
    ctx.shadowOffsetX = pen.calculative.shadowOffsetX;
    ctx.shadowOffsetY = pen.calculative.shadowOffsetY;
    ctx.shadowBlur = pen.calculative.shadowBlur;
  }

  const path = store.path2dMap.get(pen);
  if (path) {
    fill && ctx.fill(path);

    const progress = pen.calculative.progress || pen.progress;
    if (progress != null) {
      ctx.save();
      let grd = ctx.createLinearGradient(
        pen.calculative.worldRect.x,
        pen.calculative.worldRect.y,
        pen.calculative.worldRect.x + pen.calculative.worldRect.width * progress,
        pen.calculative.worldRect.y
      );
      if (pen.verticalProgress) {
        grd = ctx.createLinearGradient(
          pen.calculative.worldRect.x,
          pen.calculative.worldRect.ey,
          pen.calculative.worldRect.x,
          pen.calculative.worldRect.y + pen.calculative.worldRect.height * (1 - progress)
        );
      }
      const color = pen.calculative.progressColor || pen.calculative.color || store.options.activeColor;
      grd.addColorStop(0, color);
      grd.addColorStop(1, color);
      grd.addColorStop(1, 'transparent');

      ctx.fillStyle = grd;
      ctx.fill(path);
      ctx.restore();
    }

    ctx.stroke(path);

    if (pen.type) {
      if (pen.calculative.animatePos) {
        ctx.save();
        ctx.strokeStyle = pen.animateColor;
        let len: number;
        switch (pen.lineAnimateType) {
          case 1:
            if (pen.animateReverse) {
              ctx.lineDashOffset = pen.calculative.animatePos;
            } else {
              ctx.lineDashOffset = pen.length - pen.calculative.animatePos;
            }
            len = pen.calculative.lineWidth || 5;
            if (len < 5) {
              len = 5;
            }
            ctx.setLineDash(pen.animateLineDash || [len, len * 2]);
            break;
          case 2:
            if (pen.animateReverse) {
              ctx.lineDashOffset = pen.calculative.animatePos;
            } else {
              ctx.lineDashOffset = pen.length - pen.calculative.animatePos;
            }
            len = pen.calculative.lineWidth * 2 || 6;
            if (len < 6) {
              len = 6;
            }
            ctx.lineWidth = len;
            ctx.setLineDash([0.1, pen.length]);
            break;
          default:
            if (pen.animateReverse) {
              ctx.setLineDash([0, pen.length - pen.calculative.animatePos + 1, pen.calculative.animatePos]);
            } else {
              ctx.setLineDash([pen.calculative.animatePos, pen.length - pen.calculative.animatePos]);
            }
            break;
        }
        ctx.stroke(path);
        ctx.restore();
      }

      pen.fromArrow && renderFromArrow(ctx, pen, store);
      pen.toArrow && renderToArrow(ctx, pen, store);

      if (pen.calculative.active && !pen.calculative.pencil) {
        renderLineAnchors(ctx, pen);
      }
    }
  }

  if (globalStore.canvasDraws[pen.name]) {
    ctx.save();
    globalStore.canvasDraws[pen.name](ctx, pen, store);
    ctx.restore();
  }

  if (pen.image && pen.calculative.img) {
    ctx.save();
    ctx.shadowColor = '';
    ctx.shadowBlur = 0;
    const rect = pen.calculative.worldIconRect;
    let x = rect.x;
    let y = rect.y;
    let w = rect.width;
    let h = rect.height;
    if (pen.calculative.iconWidth) {
      w = pen.calculative.iconWidth;
    }
    if (pen.calculative.iconHeight) {
      h = pen.calculative.iconHeight;
    }
    if (pen.calculative.imgNaturalWidth && pen.calculative.imgNaturalHeight && pen.imageRatio) {
      let scaleW = rect.width / pen.calculative.imgNaturalWidth;
      let scaleH = rect.height / pen.calculative.imgNaturalHeight;
      let scaleMin = scaleW > scaleH ? scaleH : scaleW;
      const wDivideH = pen.calculative.imgNaturalWidth / pen.calculative.imgNaturalHeight;
      if (pen.calculative.iconWidth) {
        h = pen.calculative.iconWidth / wDivideH;
      } else if (pen.calculative.iconHeight) {
        w = pen.calculative.iconHeight * wDivideH;
      } else {
        w = scaleMin * pen.calculative.imgNaturalWidth;
        h = scaleMin * pen.calculative.imgNaturalHeight;
      }
    }
    x += (rect.width - w) / 2;
    y += (rect.height - h) / 2;

    switch (pen.iconAlign) {
      case 'top':
        y = rect.y;
        break;
      case 'bottom':
        y = rect.ey - h;
        break;
      case 'left':
        x = rect.x;
        break;
      case 'right':
        x = rect.ex - w;
        break;
      case 'left-top':
        x = rect.x;
        y = rect.y;
        break;
      case 'right-top':
        x = rect.ex - w;
        y = rect.y;
        break;
      case 'left-bottom':
        x = rect.x;
        y = rect.ey - h;
        break;
      case 'right-bottom':
        x = rect.ex - w;
        y = rect.ey - h;
        break;
    }

    if (pen.calculative.iconRotate) {
      ctx.translate(rect.center.x, rect.center.y);
      ctx.rotate((pen.calculative.iconRotate * Math.PI) / 180);
      ctx.translate(-rect.center.x, -rect.center.y);
    }

    ctx.drawImage(pen.calculative.img, x, y, w, h);
    ctx.restore();
  } else if (pen.calculative.icon) {
    ctx.save();
    ctx.shadowColor = '';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const iconRect = pen.calculative.worldIconRect;
    let x = iconRect.x + iconRect.width / 2;
    let y = iconRect.y + iconRect.height / 2;

    switch (pen.iconAlign) {
      case 'top':
        y = iconRect.y;
        ctx.textBaseline = 'top';
        break;
      case 'bottom':
        y = iconRect.ey;
        ctx.textBaseline = 'bottom';
        break;
      case 'left':
        x = iconRect.x;
        ctx.textAlign = 'left';
        break;
      case 'right':
        x = iconRect.ex;
        ctx.textAlign = 'right';
        break;
      case 'left-top':
        x = iconRect.x;
        y = iconRect.y;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        break;
      case 'right-top':
        x = iconRect.ex;
        y = iconRect.y;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        break;
      case 'left-bottom':
        x = iconRect.x;
        y = iconRect.ey;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        break;
      case 'right-bottom':
        x = iconRect.ex;
        y = iconRect.ey;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        break;
    }

    if (pen.calculative.iconSize > 0) {
      ctx.font = `${pen.calculative.iconSize}px ${pen.calculative.iconFamily}`;
    } else if (iconRect.width > iconRect.height) {
      ctx.font = `${iconRect.height}px ${pen.calculative.iconFamily}`;
    } else {
      ctx.font = `${iconRect.width}px ${pen.calculative.iconFamily}`;
    }
    ctx.fillStyle = pen.calculative.iconColor || pen.calculative.textColor || store.options.textColor;

    if (pen.calculative.iconRotate) {
      ctx.translate(iconRect.center.x, iconRect.center.y);
      ctx.rotate((pen.calculative.iconRotate * Math.PI) / 180);
      ctx.translate(-iconRect.center.x, -iconRect.center.y);
    }

    ctx.beginPath();
    ctx.fillText(pen.calculative.icon, x, y);

    ctx.restore();
  }

  if (pen.calculative.text) {
    ctx.save();
    if (pen.calculative.hover) {
      fill = pen.hoverTextColor || pen.hoverColor || store.options.hoverColor;
    } else if (pen.calculative.active) {
      fill = pen.activeTextColor || pen.activeColor || store.options.activeColor;
    } else {
      fill = undefined;
    }
    if (fill) {
      ctx.fillStyle = fill;
    } else {
      ctx.fillStyle = pen.calculative.textColor || pen.calculative.color || store.options.color;
    }

    if (pen.calculative.textBackground) {
      ctx.save();
      ctx.fillStyle = pen.calculative.textBackground;
      ctx.fillRect(
        pen.calculative.textDrawRect.x,
        pen.calculative.textDrawRect.y,
        pen.calculative.textDrawRect.width,
        pen.calculative.textDrawRect.height
      );
      ctx.restore();
    }

    ctx.font = `${pen.calculative.fontStyle || 'normal'} normal ${pen.calculative.fontWeight || 'normal'} ${
      pen.calculative.fontSize
    }px/${pen.calculative.lineHeight} ${pen.calculative.fontFamily}`;

    if (pen.textAlign) {
      ctx.textAlign = pen.textAlign as any;
    } else {
      ctx.textAlign = 'center';
    }

    // if (pen.textBaseline) {
    //   ctx.textBaseline = pen.textBaseline as any;
    // }

    const y = 0.5;
    // switch (pen.textBaseline) {
    //   case 'top':
    //     y = 0;
    //     break;
    //   case 'bottom':
    //     y = 1;
    //     break;
    // }
    pen.calculative.textLines.forEach((text, i) => {
      let x = 0;
      if (!pen.textAlign || pen.textAlign === 'center') {
        x = pen.calculative.textDrawRect.width / 2;
      } else if (pen.textAlign === 'right') {
        x = pen.calculative.textDrawRect.width;
      }
      ctx.fillText(
        text,
        pen.calculative.textDrawRect.x + x,
        pen.calculative.textDrawRect.y + (i + y) * pen.calculative.fontSize * pen.calculative.lineHeight
      );
    });

    ctx.restore();
  }

  ctx.restore();
}

export function renderPenRaw(ctx: CanvasRenderingContext2D, pen: Pen, rect?: Rect) {
  ctx.save();
  if (rect) {
    ctx.translate(-rect.x, -rect.y);
  }

  ctx.beginPath();
  // for canvas2svg
  if ((ctx as any).setAttrs) {
    (ctx as any).setAttrs(pen);
  }
  // end

  if (pen.calculative.flip) {
    if (pen.calculative.flip === Flip.Horizontal) {
      if (rect) {
        ctx.translate(pen.calculative.worldRect.x + pen.calculative.worldRect.ex - rect.x, -rect.y);
      } else {
        ctx.translate(pen.calculative.worldRect.x + pen.calculative.worldRect.ex, 0);
      }
      ctx.scale(-1, 1);
    } else if (pen.calculative.flip === Flip.Vertical) {
      if (rect) {
        ctx.translate(-rect.x, pen.calculative.worldRect.y + pen.calculative.worldRect.ey - rect.x);
      } else {
        ctx.translate(0, pen.calculative.worldRect.y + pen.calculative.worldRect.ey);
      }
      ctx.scale(1, -1);
    }
  }

  if (pen.calculative.rotate && pen.name !== 'line') {
    ctx.translate(pen.calculative.worldRect.center.x, pen.calculative.worldRect.center.y);
    let rotate = (pen.calculative.rotate * Math.PI) / 180;
    // 目前只有水平和垂直翻转，都需要 * -1
    pen.calculative.flip && (rotate *= -1);
    ctx.rotate(rotate);
    ctx.translate(-pen.calculative.worldRect.center.x, -pen.calculative.worldRect.center.y);
  }

  if (pen.calculative.lineWidth > 1) {
    ctx.lineWidth = pen.calculative.lineWidth;
  }

  const store = pen.calculative.canvas.store;

  let fill: any;
  if (pen.calculative.hover) {
    ctx.strokeStyle = pen.hoverColor || store.options.hoverColor;
    ctx.fillStyle = pen.hoverBackground || store.options.hoverBackground;
    fill = pen.hoverBackground || store.options.hoverBackground;
  } else if (pen.calculative.active) {
    ctx.strokeStyle = pen.activeColor || store.options.activeColor;
    ctx.fillStyle = pen.activeBackground || store.options.activeBackground;
    fill = pen.activeBackground || store.options.activeBackground;
  } else {
    if (pen.strokeImage) {
      if (pen.calculative.strokeImg) {
        ctx.strokeStyle = ctx.createPattern(pen.calculative.strokeImg, 'repeat');
        fill = true;
      }
    } else {
      ctx.strokeStyle = pen.calculative.color || '#000000';
    }

    if (pen.backgroundImage) {
      if (pen.calculative.backgroundImg) {
        ctx.fillStyle = ctx.createPattern(pen.calculative.backgroundImg, 'repeat');
        fill = true;
      }
    } else {
      ctx.fillStyle = pen.background;
      fill = !!pen.background;
    }
  }

  if (pen.calculative.lineCap) {
    ctx.lineCap = pen.calculative.lineCap as CanvasLineCap;
  } else if (pen.type) {
    ctx.lineCap = 'round';
  }

  if (pen.calculative.lineJoin) {
    ctx.lineJoin = pen.calculative.lineJoin as CanvasLineJoin;
  } else if (pen.type) {
    ctx.lineJoin = 'round';
  }

  if (pen.calculative.globalAlpha < 1) {
    ctx.globalAlpha = pen.calculative.globalAlpha;
  }

  if (pen.calculative.lineDash) {
    ctx.setLineDash(pen.calculative.lineDash);
  }
  if (pen.calculative.lineDashOffset) {
    ctx.lineDashOffset = pen.calculative.lineDashOffset;
  }

  if (pen.calculative.shadowColor) {
    ctx.shadowColor = pen.calculative.shadowColor;
    ctx.shadowOffsetX = pen.calculative.shadowOffsetX;
    ctx.shadowOffsetY = pen.calculative.shadowOffsetY;
    ctx.shadowBlur = pen.calculative.shadowBlur;
  }

  if (globalStore.path2dDraws[pen.name]) {
    ctx.save();
    ctx.beginPath();
    globalStore.path2dDraws[pen.name](pen, ctx);
    fill && ctx.fill();
    ctx.stroke();
    ctx.restore();

    const progress = pen.calculative.progress || pen.progress;
    if (progress != null) {
      ctx.save();
      let grd = ctx.createLinearGradient(
        pen.calculative.worldRect.x,
        pen.calculative.worldRect.y,
        pen.calculative.worldRect.x + pen.calculative.worldRect.width * progress,
        pen.calculative.worldRect.y
      );
      if (pen.verticalProgress) {
        grd = ctx.createLinearGradient(
          pen.calculative.worldRect.x,
          pen.calculative.worldRect.ey,
          pen.calculative.worldRect.x,
          pen.calculative.worldRect.y + pen.calculative.worldRect.height * (1 - progress)
        );
      }
      const color = pen.progressColor || pen.color || store.options.activeColor;
      grd.addColorStop(0, color);
      grd.addColorStop(1, color);
      grd.addColorStop(1, 'transparent');

      ctx.fillStyle = grd;
      ctx.beginPath();
      globalStore.path2dDraws[pen.name](pen, ctx);
      ctx.fill();
      ctx.restore();
    }
  }

  if (globalStore.canvasDraws[pen.name]) {
    ctx.save();
    const ret = globalStore.canvasDraws[pen.name](ctx, pen, store);
    ctx.restore();
    if (ret) {
      return;
    }
  }

  if (pen.image && pen.calculative.img) {
    ctx.save();
    ctx.shadowColor = '';
    ctx.shadowBlur = 0;
    const rect = pen.calculative.worldIconRect;
    let x = rect.x;
    let y = rect.y;
    let w = rect.width;
    let h = rect.height;
    if (pen.calculative.iconWidth) {
      w = pen.calculative.iconWidth;
    }
    if (pen.calculative.iconHeight) {
      h = pen.calculative.iconHeight;
    }
    if (pen.calculative.imgNaturalWidth && pen.calculative.imgNaturalHeight) {
      let scaleW = rect.width / pen.calculative.imgNaturalWidth;
      let scaleH = rect.height / pen.calculative.imgNaturalHeight;
      let scaleMin = scaleW > scaleH ? scaleH : scaleW;
      if (pen.iconWidth) {
        h = scaleMin * pen.iconWidth;
      } else {
        w = scaleMin * pen.calculative.imgNaturalWidth;
      }
      if (pen.iconHeight) {
        h = scaleMin * pen.iconHeight;
      } else {
        h = scaleMin * pen.calculative.imgNaturalHeight;
      }
    }
    x += (rect.width - w) / 2;
    y += (rect.height - h) / 2;

    if (pen.iconRotate) {
      ctx.translate(rect.center.x, rect.center.y);
      ctx.rotate((pen.iconRotate * Math.PI) / 180);
      ctx.translate(-rect.center.x, -rect.center.y);
    }

    ctx.drawImage(pen.calculative.img, x, y, w, h);
    ctx.restore();
  } else if (pen.icon) {
    ctx.save();
    ctx.shadowColor = '';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const iconRect = pen.calculative.worldIconRect;
    let x = iconRect.x + iconRect.width / 2;
    let y = iconRect.y + iconRect.height / 2;

    if (pen.calculative.iconSize > 0) {
      ctx.font = `${pen.calculative.iconSize}px ${pen.calculative.iconFamily}`;
    } else if (iconRect.width > iconRect.height) {
      ctx.font = `${iconRect.height}px ${pen.calculative.iconFamily}`;
    } else {
      ctx.font = `${iconRect.width}px ${pen.calculative.iconFamily}`;
    }
    ctx.fillStyle = pen.iconColor || pen.textColor || store.options.textColor;

    if (pen.calculative.worldRect.rotate) {
      ctx.translate(iconRect.center.x, iconRect.center.y);
      ctx.rotate((pen.calculative.worldRect.rotate * Math.PI) / 180);
      ctx.translate(-iconRect.center.x, -iconRect.center.y);
    }

    ctx.beginPath();
    ctx.fillText(pen.icon, x, y);

    ctx.restore();
  }

  if (pen.calculative.text) {
    ctx.save();
    ctx.fillStyle = pen.calculative.textColor || pen.calculative.color;
    if (pen.calculative.textBackground) {
      ctx.save();
      ctx.fillStyle = pen.calculative.textBackground;
      let x = 0;
      if (pen.textAlign === 'right') {
        x = pen.calculative.textDrawRect.width;
      }
      ctx.fillRect(
        pen.calculative.textDrawRect.x - x,
        pen.calculative.textDrawRect.y,
        pen.calculative.textDrawRect.width,
        pen.calculative.textDrawRect.height
      );
      ctx.restore();
    }

    ctx.font = `${pen.fontStyle || 'normal'} normal ${pen.calculative.fontWeight || 'normal'} ${
      pen.calculative.fontSize
    }px/${pen.calculative.lineHeight} ${pen.calculative.fontFamily}`;

    if (pen.textAlign) {
      ctx.textAlign = pen.textAlign as any;
    } else {
      ctx.textAlign = 'center';
    }

    if (pen.textBaseline) {
      ctx.textBaseline = pen.textBaseline as any;
    }

    let y = 0.5;
    switch (pen.textBaseline) {
      case 'top':
        y = 0;
        break;
      case 'bottom':
        y = 1;
        break;
    }
    pen.calculative.textLines.forEach((text, i) => {
      let x = 0;
      if (!pen.textAlign || pen.textAlign === 'center') {
        x = pen.calculative.textDrawRect.width / 2;
      }
      ctx.fillText(
        text,
        pen.calculative.textDrawRect.x + x,
        pen.calculative.textDrawRect.y + (i + y) * pen.calculative.fontSize * pen.calculative.lineHeight
      );
    });

    ctx.restore();
  }

  ctx.restore();
}

export function renderLineAnchors(ctx: CanvasRenderingContext2D, pen: Pen) {
  const store = pen.calculative.canvas.store;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.fillStyle = pen.activeColor || store.options.activeColor;
  pen.calculative.worldAnchors.forEach((pt) => {
    !pt.hidden && renderAnchor(ctx, pt, pen);
  });
  ctx.restore();
}

export function renderAnchor(ctx: CanvasRenderingContext2D, pt: Point, pen: Pen) {
  if (!pt) {
    return;
  }

  const active = pen.calculative.activeAnchor === pt;
  let r = 3;
  if (pen.calculative.lineWidth > 3) {
    r = pen.calculative.lineWidth;
  }

  if (active) {
    if (pt.prev) {
      ctx.save();
      ctx.strokeStyle = '#4dffff';
      ctx.beginPath();
      ctx.moveTo(pt.prev.x, pt.prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.prev.x, pt.prev.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (pt.next) {
      ctx.save();
      ctx.strokeStyle = '#4dffff';
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.next.x, pt.next.y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.next.x, pt.next.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function calcWorldRects(pen: Pen) {
  const store = pen.calculative.canvas.store;

  let rect: Rect = {
    x: pen.x,
    y: pen.y,
  };

  if (!pen.parentId) {
    rect.ex = pen.x + pen.width;
    rect.ey = pen.y + pen.height;
    rect.width = pen.width;
    rect.height = pen.height;
    rect.rotate = pen.rotate;
    rect.center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  } else {
    let parentRect = store.pens[pen.parentId].calculative.worldRect;
    if (!parentRect) {
      parentRect = calcWorldRects(store.pens[pen.parentId]);
    }

    rect.x = parentRect.x + parentRect.width * pen.x;
    rect.y = parentRect.y + parentRect.height * pen.y;
    rect.width = parentRect.width * pen.width;
    rect.height = parentRect.height * pen.height;

    if (Math.abs(pen.x) > 1) {
      rect.x = parentRect.x + pen.x;
    }
    if (Math.abs(pen.y) > 1) {
      rect.y = parentRect.y + pen.y;
    }
    if (pen.width > 1) {
      rect.width = pen.width;
    }
    if (pen.height > 1) {
      rect.height = pen.height;
    }
    rect.ex = rect.x + rect.width;
    rect.ey = rect.y + rect.height;

    rect.rotate = parentRect.rotate + pen.rotate;
    rect.center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  }

  pen.calculative.worldRect = rect;
  // 这里的 rect 均是绝对值
  calcPadding(pen, rect);

  return rect;
}

function calcPadding(pen: Pen, rect: Rect) {
  !pen.paddingTop && (pen.calculative.paddingTop = 0);
  !pen.paddingBottom && (pen.calculative.paddingBottom = 0);
  !pen.paddingLeft && (pen.calculative.paddingLeft = 0);
  !pen.paddingRight && (pen.calculative.paddingRight = 0);

  pen.calculative.paddingTop < 1 && (pen.calculative.paddingTop *= rect.height);
  pen.calculative.paddingBottom < 1 && (pen.calculative.paddingBottom *= rect.height);
  pen.calculative.paddingLeft < 1 && (pen.calculative.paddingLeft *= rect.width);
  pen.calculative.paddingRight < 1 && (pen.calculative.paddingRight *= rect.width);
}

export function calcPenRect(pen: Pen) {
  if (!pen.parentId) {
    pen.x = pen.calculative.worldRect.x;
    pen.y = pen.calculative.worldRect.y;
    pen.width = pen.calculative.worldRect.width;
    pen.height = pen.calculative.worldRect.height;
    return;
  }
  const store = pen.calculative.canvas.store;
  const parentRect = store.pens[pen.parentId].calculative.worldRect;
  pen.x = (pen.calculative.worldRect.x - parentRect.x) / parentRect.width;
  pen.y = (pen.calculative.worldRect.y - parentRect.y) / parentRect.height;
  pen.width = pen.calculative.worldRect.width / parentRect.width;
  pen.height = pen.calculative.worldRect.height / parentRect.height;
}

export function calcWorldAnchors(pen: Pen) {
  const anchors: Point[] = [];
  if (pen.anchors) {
    pen.anchors.forEach((anchor) => {
      anchors.push(calcWorldPointOfPen(pen, anchor));
    });
  }

  // Default anchors of node
  if (!anchors.length && !pen.type && pen.name !== 'combine') {
    anchors.push({
      id: '0',
      penId: pen.id,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * 0.5,
      y: pen.calculative.worldRect.y,
    });

    anchors.push({
      id: '1',
      penId: pen.id,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * 0.5,
    });

    anchors.push({
      id: '2',
      penId: pen.id,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * 0.5,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height,
    });

    anchors.push({
      id: '3',
      penId: pen.id,
      x: pen.calculative.worldRect.x,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * 0.5,
    });
  }

  if (pen.calculative.rotate) {
    anchors.forEach((anchor) => {
      rotatePoint(anchor, pen.calculative.rotate, pen.calculative.worldRect.center);
    });
  }

  if (!pen.type || pen.anchors) {
    pen.calculative.worldAnchors = anchors;
  }

  if (pen.calculative.activeAnchor && anchors.length) {
    pen.calculative.activeAnchor = anchors.find((a) => {
      a.id === pen.calculative.activeAnchor.id;
    });
  }
}

export function calcWorldPointOfPen(pen: Pen, pt: Point) {
  const p: Point = { ...pt };
  p.x = pen.calculative.worldRect.x + pen.calculative.worldRect.width * pt.x;
  p.y = pen.calculative.worldRect.y + pen.calculative.worldRect.height * pt.y;
  if (pt.prev) {
    p.prev = {
      penId: pen.id,
      connectTo: pt.prev.connectTo,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * pt.prev.x,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * pt.prev.y,
    };
  }
  if (pt.next) {
    p.next = {
      penId: pen.id,
      connectTo: pt.next.connectTo,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * pt.next.x,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * pt.next.y,
    };
  }

  return p;
}

export function calcIconRect(pens: { [key: string]: Pen }, pen: Pen) {
  const { paddingTop, paddingBottom, paddingLeft, paddingRight } = pen.calculative;
  let x = paddingLeft;
  let y = paddingTop;
  let width = pen.calculative.worldRect.width - paddingLeft - paddingRight;
  let height = pen.calculative.worldRect.height - paddingTop - paddingBottom;
  let iconLeft = pen.calculative.iconLeft;
  let iconTop = pen.calculative.iconTop;
  if (iconLeft && Math.abs(iconLeft) < 1) {
    iconLeft = pen.calculative.worldRect.width * iconLeft;
  }

  if (iconTop && Math.abs(iconTop) < 1) {
    iconTop = pen.calculative.worldRect.height * iconTop;
  }
  x += iconLeft || 0;
  y += iconTop || 0;
  width -= iconLeft || 0;
  height -= iconTop || 0;
  // TODO: 边缘情况，若出现再看
  width < 1 && console.error('width < 1 的情况');

  let rotate = pen.calculative.iconRotate || 0;
  if (pen.parentId) {
    const parentPen = pens[pen.parentId].calculative;
    if (parentPen) {
      rotate += parentPen.rotate;
      rotate %= 360;
    }
  }

  x = pen.calculative.worldRect.x + x;
  y = pen.calculative.worldRect.y + y;
  pen.calculative.worldIconRect = {
    x,
    y,
    width,
    height,
    ex: x + width,
    ey: y + height,
    rotate,
  };
  calcCenter(pen.calculative.worldIconRect);
}

export function scalePen(pen: Pen, scale: number, center: Point) {
  scaleRect(pen.calculative.worldRect, scale, center);

  if (pen.calculative.initRect) {
    scaleRect(pen.calculative.initRect, scale, center);
  }
  if (pen.lastFrame && pen.lastFrame.width) {
    pen.lastFrame.width *= scale;
  }
  if (pen.calculative.x) {
    scalePoint(pen.calculative as any, scale, center);
  }

  if (pen.type) {
    calcWorldAnchors(pen);
  }
}

export function pushPenAnchor(pen: Pen, pt: Point) {
  if (!pen.anchors) {
    pen.anchors = [];
  }
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  const worldAnchor = {
    id: pt.id,
    penId: pen.id,
    x: pt.x,
    y: pt.y,
  };
  pen.calculative.worldAnchors.push(worldAnchor);

  if (pen.calculative.worldRect) {
    if (pen.rotate % 360) {
      rotatePoint(pt, -pen.rotate, pen.calculative.worldRect.center);
    }

    const anchor = {
      id: pt.id,
      penId: pen.id,
      x: (pt.x - pen.calculative.worldRect.x) / pen.calculative.worldRect.width,
      y: (pt.y - pen.calculative.worldRect.y) / pen.calculative.worldRect.height,
    };
    pen.anchors.push(anchor);
  }

  return worldAnchor;
}

export function addLineAnchor(pen: Pen, pt: Point, index: number) {
  if (!pen.anchors) {
    pen.anchors = [];
  }
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  const worldAnchor = getSplitAnchor(pen, pt, index);
  pen.calculative.worldAnchors.splice(index + 1, 0, worldAnchor);
  pen.anchors.splice(index + 1, 0, calcRelativePoint(worldAnchor, pen.calculative.worldRect));
  pen.calculative.activeAnchor = worldAnchor;
  return worldAnchor;
}

export function removePenAnchor(pen: Pen, anchor: Point) {
  if (!pen || !pen.calculative.worldAnchors) {
    return;
  }
  let i = pen.calculative.worldAnchors.findIndex((a) => a.id === anchor.id);
  if (i > -1) {
    pen.calculative.worldAnchors.splice(i, 1);
  }

  i = pen.anchors.findIndex((a) => a.id === anchor.id);
  if (i > -1) {
    pen.anchors.splice(i, 1);
  }
}

export function facePen(pt: Point, pen?: Pen) {
  if (!pen || !pen.calculative || !pen.calculative.worldRect.center) {
    return Direction.None;
  }

  return facePoint(pt, pen.calculative.worldRect.center);
}

export function nearestAnchor(pen: Pen, pt: Point) {
  let dis = Infinity;
  let anchor: Point;
  pen.calculative.worldAnchors.forEach((a: Point) => {
    const d = distance(pt, a);
    if (dis > d) {
      dis = d;
      anchor = a;
    }
  });

  return anchor;
}

export function translateLine(pen: Pen, x: number, y: number) {
  pen.x += x;
  pen.y += y;

  if (pen.anchors) {
    pen.anchors.forEach((a) => {
      translatePoint(a, x, y);
    });
  }

  if (pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors.forEach((a) => {
      translatePoint(a, x, y);
    });
  }
}

export function deleteTempAnchor(pen: Pen) {
  if (pen && pen.calculative && pen.calculative.worldAnchors.length) {
    let to: Point = pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 1];
    while (pen.calculative.worldAnchors.length && to !== pen.calculative.activeAnchor) {
      pen.calculative.worldAnchors.pop();
      to = pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 1];
    }
  }
}

export function connectLine(pen: Pen, lineId: string, lineAnchor: string, anchor: string) {
  if (!pen || !lineId || !lineAnchor || !anchor) {
    return;
  }

  if (!pen.connectedLines) {
    pen.connectedLines = [];
  }

  const i = pen.connectedLines.findIndex(
    (item) => item.lineId === lineId && item.lineAnchor === lineAnchor && item.anchor === anchor
  );

  if (i < 0) {
    pen.connectedLines.push({
      lineId,
      lineAnchor,
      anchor,
    });
  }
}

export function disconnectLine(pen: Pen, lineId: string, lineAnchor: string, anchor: string) {
  if (!pen || !lineId || !lineAnchor || !anchor) {
    return;
  }

  if (!pen.connectedLines) {
    pen.connectedLines = [];
  }

  const i = pen.connectedLines.findIndex(
    (item) => item.lineId === lineId && item.lineAnchor === lineAnchor && item.anchor === anchor
  );
  i > -1 && pen.connectedLines.splice(i, 1);
}

export function getAnchor(pen: Pen, anchorId: string) {
  if (!pen || !anchorId) {
    return;
  }

  if (pen.calculative.worldAnchors) {
    for (const item of pen.calculative.worldAnchors) {
      if (item.id === anchorId) {
        return item;
      }
    }
  }
}

export function getFromAnchor(pen: Pen) {
  if (!pen || !pen.calculative.worldAnchors) {
    return;
  }

  return pen.calculative.worldAnchors[0];
}

export function getToAnchor(pen: Pen) {
  if (!pen || !pen.calculative.worldAnchors) {
    return;
  }

  return pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 1];
}

export function setNodeAnimate(pen: Pen, now: number) {
  if (pen.calculative.start === 0 || !pen.frames || !pen.frames.length) {
    pen.calculative.start = undefined;
    return 0;
  }
  if (!pen.calculative.duration) {
    pen.calculative.duration = 0;
    for (const f of pen.frames) {
      pen.calculative.duration += f.duration;
      for (const k in f) {
        if (k !== 'duration' && !pen[k]) {
          if (k === 'scale') {
            pen[k] = 1;
          } else {
            pen[k] = undefined;
          }
        }
      }
    }
  }
  if (!pen.animateCycle) {
    pen.animateCycle = Infinity;
  }

  if (!pen.calculative.start) {
    pen.calculative.start = Date.now();
    pen.calculative.frameIndex = 0;
    pen.calculative.frameStart = pen.calculative.start;
    pen.calculative.frameDuration = pen.frames[0].duration;
    pen.calculative.frameEnd = pen.calculative.frameStart + pen.calculative.frameDuration;
    pen.calculative.cycleIndex = 1;

    pen.lastFrame = {};
    for (const k in pen) {
      if (typeof pen[k] !== 'object' || k === 'lineDash') {
        pen.lastFrame[k] = pen[k];
      }
    }
    pen.lastFrame.rotate = 0;
    pen.lastFrame.x = 0;
    pen.lastFrame.y = 0;
    pen.lastFrame.width = pen.calculative.worldRect.width;
    pen.calculative.x = pen.calculative.worldRect.x;
    pen.calculative.y = pen.calculative.worldRect.y;
    pen.calculative.initRect = deepClone(pen.calculative.worldRect);
  } else if (now > pen.calculative.frameEnd) {
    pen.lastFrame = {
      rotate: pen.frames[pen.calculative.frameIndex].rotate || 0,
      x: pen.frames[pen.calculative.frameIndex].x || 0,
      y: pen.frames[pen.calculative.frameIndex].y || 0,
      width: (pen.frames[pen.calculative.frameIndex].scale || 1) * pen.calculative.initRect.width,
    };

    pen.calculative.x = pen.calculative.worldRect.x;
    pen.calculative.y = pen.calculative.worldRect.y;
    pen.calculative._rotate = pen.calculative.rotate || 0;

    // 播放到尾了
    if (++pen.calculative.frameIndex >= pen.frames.length) {
      ++pen.calculative.cycleIndex;
      pen.calculative.frameIndex = 0;
    }
    // 播放结束
    if (pen.calculative.cycleIndex > pen.animateCycle) {
      pen.calculative.start = undefined;
      return 0;
    }
    pen.calculative.frameStart = pen.calculative.frameEnd;
    pen.calculative.frameDuration = pen.frames[pen.calculative.frameIndex].duration;
    pen.calculative.frameEnd = pen.calculative.frameStart + pen.calculative.frameDuration;

    for (const k in pen) {
      if (
        k !== 'rotate' &&
        k !== 'x' &&
        k !== 'y' &&
        k !== 'width' &&
        k !== 'initRect' &&
        (typeof pen[k] !== 'object' || k === 'lineDash')
      ) {
        pen.lastFrame[k] = pen.calculative[k];
      }
    }
  }

  const frame = pen.frames[pen.calculative.frameIndex];
  let process = ((now - pen.calculative.frameStart) / pen.calculative.frameDuration) % 1;
  if (process > 0) {
    let rect: Rect;
    let scale: number;
    for (const k in frame) {
      if (k === 'duration') {
        continue;
      } else if (k === 'scale') {
        // 基准值 + 进度值
        const current =
          pen.lastFrame.width + (frame.scale * pen.calculative.initRect.width - pen.lastFrame.width) * process;
        rect = pen.calculative.worldRect;
        scale = current / rect.width;
        rect.width *= scale;
        rect.height *= scale;
        pen.calculative.dirty = true;
      } else if (k === 'x') {
        translateRect(
          pen.calculative.worldRect,
          pen.calculative.x + (frame[k] - pen.lastFrame[k]) * process - pen.calculative.worldRect.x,
          0
        );
        pen.calculative.dirty = true;
      } else if (k === 'y') {
        translateRect(
          pen.calculative.worldRect,
          0,
          pen.calculative.y + (frame[k] - pen.lastFrame[k]) * process - pen.calculative.worldRect.y
        );
        pen.calculative.dirty = true;
      } else if (k === 'rotate') {
        if (!pen.calculative._rotate) {
          pen.calculative._rotate = pen.rotate || 0;
        }
        if (pen.lastFrame[k] >= 360) {
          pen.lastFrame[k] %= 360;
        }
        pen.calculative.rotate = (pen.calculative._rotate + (frame[k] - pen.lastFrame[k]) * process) % 360;
        pen.calculative.dirty = true;
      } else if (isLinear(frame[k], k, pen)) {
        if (!pen.lastFrame[k]) {
          pen.lastFrame[k] = 0;
        }
        const current = pen.lastFrame[k] + (frame[k] - pen.lastFrame[k]) * process;
        pen.calculative[k] = Math.round(current * 100) / 100;
      } else {
        pen.calculative[k] = frame[k];
      }

      if (k === 'text') {
        calcTextLines(pen);
      }
    }

    if (rect) {
      scalePoint(rect as Point, scale, rect.center);
      rect.ex = rect.x + rect.width;
      rect.ey = rect.y + rect.height;
      rect.center = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
    }
  }

  return true;
}

/**
 * 值类型为 number , pen.linear 为 false 时，且 key 不属于 noLinear 时，返回 true
 * @param value 值
 * @param key 键值
 * @param pen 画笔
 * @returns
 */
function isLinear(value: any, key: string, pen: Pen): boolean {
  // 不线性变化的属性
  const noLinear = ['strokeType', 'bkType'];
  return typeof value === 'number' && pen.linear !== false && !noLinear.includes(key);
}

export function setLineAnimate(pen: Pen, now: number) {
  if (pen.calculative.start === 0) {
    pen.calculative.start = undefined;
    pen.calculative.frameStart = undefined;
    return 0;
  }

  if (!pen.animateCycle) {
    pen.animateCycle = Infinity;
  }

  if (!pen.animateSpan) {
    pen.animateSpan = 1;
  }

  if (!pen.calculative.duration && pen.frames) {
    pen.calculative.duration = 0;
    for (const f of pen.frames) {
      pen.calculative.duration += f.duration;
      for (const k in f) {
        if (k !== 'duration' && !pen[k]) {
          pen[k] = undefined;
        }
      }
    }
  }

  pen.calculative.animatePos += pen.animateSpan;
  if (!pen.calculative.start) {
    pen.calculative.start = Date.now();
    pen.calculative.animatePos = pen.animateSpan;
    if (!pen.animateColor) {
      pen.animateColor = '#ff4d4f';
    }
    pen.calculative.frameIndex = 0;
    pen.calculative.frameStart = pen.calculative.start;
    if (pen.frames && pen.frames.length) {
      pen.calculative.frameDuration = pen.frames[0].duration;
      pen.calculative.frameEnd = pen.calculative.frameStart + pen.calculative.frameDuration;
    }
    pen.calculative.cycleIndex = 1;

    pen.lastFrame = {};
    for (const k in pen) {
      if (typeof pen[k] !== 'object' || k === 'lineDash') {
        pen.lastFrame[k] = pen[k];
      }
    }
  } else if (now > pen.calculative.frameEnd || pen.calculative.animatePos > pen.length) {
    // 播放到尾了
    if (pen.calculative.animatePos > pen.length) {
      pen.calculative.frameIndex = 0;
      ++pen.calculative.cycleIndex;
    }

    // 播放结束
    if (pen.calculative.cycleIndex > pen.animateCycle) {
      pen.calculative.start = undefined;
      return 0;
    }
    pen.calculative.animatePos = pen.animateSpan;

    if (pen.frames && pen.frames.length) {
      pen.calculative.frameStart = pen.calculative.frameEnd;
      pen.calculative.frameDuration = pen.frames[pen.calculative.frameIndex].duration;
      pen.calculative.frameEnd = pen.calculative.frameStart + pen.calculative.frameDuration;

      pen.lastFrame = {};
      for (const k in pen) {
        if (typeof pen[k] !== 'object' || k === 'lineDash') {
          pen.lastFrame[k] = pen.calculative[k];
        }
      }
    }
  }

  if (!pen.calculative.inView || !pen.frames || !pen.frames.length) {
    return true;
  }

  const frame = pen.frames[pen.calculative.frameIndex];
  let process = (now - pen.calculative.frameStart) / pen.calculative.frameDuration;
  if (process > 0) {
    for (const k in frame) {
      if (k === 'duration') {
        continue;
      } else if (typeof frame[k] === 'number' && pen.linear !== false) {
        if (!pen[k]) {
          pen[k] = 0;
        }
        if (!pen.calculative[k]) {
          pen.calculative[k] = 0;
        }
        if (pen.calculative.frameIndex || pen.calculative.cycleIndex) {
          const current = pen.lastFrame[k] + (frame[k] - pen.lastFrame[k]) * process;
          pen.calculative[k] = Math.round(current * 100) / 100;
        } else {
          pen.calculative[k] = Math.round(pen[k] + frame[k] * process * 100) / 100;
        }
      } else {
        pen.calculative[k] = frame[k];
      }

      if (k === 'text') {
        calcTextLines(pen);
      }
    }
  }

  return true;
}

export function setChildrenActive(pen: Pen, active = true) {
  if (!pen.children) {
    return;
  }
  const store = pen.calculative.canvas.store;
  pen.children.forEach((id) => {
    const child: Pen = store.pens[id];
    child.calculative.active = active;

    setChildrenActive(child);
  });
}

export function setHover(pen: Pen, hover = true) {
  if (!pen) {
    return;
  }
  const store = pen.calculative.canvas.store;
  pen.calculative.hover = hover;
  if (pen.children) {
    pen.children.forEach((id) => {
      setHover(store.pens[id], hover);
    });
  }
}

export function setElemPosition(pen: Pen, elem: HTMLElement) {
  if (!elem) {
    return;
  }
  const store = pen.calculative.canvas.store;
  const worldRect = pen.calculative.worldRect;
  elem.style.position = 'absolute';
  elem.style.outline = 'none';
  elem.style.left = worldRect.x + store.data.x + 'px';
  elem.style.top = worldRect.y + store.data.y + 'px';
  elem.style.width = worldRect.width + 'px';
  elem.style.height = worldRect.height + 'px';
  elem.style.display = pen.calculative.visible !== false ? 'inline' : 'none'; // 是否隐藏元素
  if (pen.calculative.rotate) {
    elem.style.transform = `rotate(${pen.calculative.rotate}deg)`;
  }
  if (pen.locked || store.data.locked) {
    elem.style.userSelect = 'initial';
    elem.style.pointerEvents = 'initial';
  } else {
    elem.style.userSelect = 'none';
    elem.style.pointerEvents = 'none';
  }
}

/**
 * 画笔们的 locked >= 1
 * @param pens 画笔
 * @returns
 */
export function getPensLock(pens: Pen[]): boolean {
  for (const pen of pens) {
    if (!pen.locked) {
      return false;
    }
  }
  return true;
}
