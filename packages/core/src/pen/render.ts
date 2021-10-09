import { Pen } from './model';
import { getSplitAnchor } from '../diagrams';
import { Direction } from '../data';
import { distance, facePoint, Point, rotatePoint, scalePoint, translatePoint } from '../point';
import { calcCenter, calcRelativePoint, Rect, scaleRect, translateRect } from '../rect';
import { globalStore, TopologyStore } from '../store';
import { calcTextLines } from './text';
import { deepClone } from '../utils/clone';
import { renderFromArrow, renderToArrow } from './arrow';

export function getParent(store: TopologyStore, pen: Pen) {
  if (!pen || !pen.parentId) {
    return undefined;
  }

  return getParent(store, store.pens[pen.parentId]) || store.pens[pen.parentId];
}

export function getAllChildren(store: TopologyStore, pen: Pen) {
  if (!pen || !pen.children) {
    return [];
  }

  const children: Pen[] = [];
  pen.children.forEach((id) => {
    children.push(store.pens[id]);
    children.push(...getAllChildren(store, store.pens[id]));
  });
  return children;
}

export function renderPen(ctx: CanvasRenderingContext2D, pen: Pen, path: Path2D, store: TopologyStore) {
  if (!pen.gif && pen.calculative.gif && pen.calculative.img) {
    pen.calculative.gif = undefined;
    pen.calculative.canvas.externalElements.removeChild(pen.calculative.img);
  } else if (pen.gif && !pen.calculative.gif && pen.calculative.img) {
    pen.calculative.canvas.externalElements.appendChild(pen.calculative.img);
    setElemPosition(pen, pen.calculative.img);
    pen.calculative.gif = true;
  }

  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.beginPath();

  if (pen.calculative.rotate && pen.name !== 'line') {
    ctx.translate(pen.calculative.worldRect.center.x, pen.calculative.worldRect.center.y);
    ctx.rotate((pen.calculative.rotate * Math.PI) / 180);
    ctx.translate(-pen.calculative.worldRect.center.x, -pen.calculative.worldRect.center.y);
  }

  if (pen.calculative.lineWidth > 1) {
    ctx.lineWidth = pen.calculative.lineWidth;
  }

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
      ctx.strokeStyle = pen.calculative.color;
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
      const color = pen.progressColor || pen.color || store.options.activeColor;
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
        renderLineAnchors(ctx, pen, store);
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
      ctx.font = `${pen.calculative.iconSize}px ${pen.iconFamily}`;
    } else if (iconRect.width > iconRect.height) {
      ctx.font = `${iconRect.height}px ${pen.iconFamily}`;
    } else {
      ctx.font = `${iconRect.width}px ${pen.iconFamily}`;
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

    ctx.font = `${pen.fontStyle || 'normal'} normal ${pen.fontWeight || 'normal'} ${pen.fontSize}px/${pen.lineHeight} ${
      pen.fontFamily
    }`;

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
        pen.calculative.textDrawRect.y + (i + y) * pen.fontSize * pen.lineHeight
      );
    });

    ctx.restore();
  }

  ctx.restore();
}

export function renderPenRaw(ctx: CanvasRenderingContext2D, pen: Pen, store: TopologyStore, rect?: Rect) {
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

  if (pen.calculative.rotate && pen.name !== 'line') {
    ctx.translate(pen.calculative.worldRect.center.x, pen.calculative.worldRect.center.y);
    ctx.rotate((pen.calculative.rotate * Math.PI) / 180);
    ctx.translate(-pen.calculative.worldRect.center.x, -pen.calculative.worldRect.center.y);
  }

  if (pen.calculative.lineWidth > 1) {
    ctx.lineWidth = pen.calculative.lineWidth;
  }

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
      ctx.font = `${pen.calculative.iconSize}px ${pen.iconFamily}`;
    } else if (iconRect.width > iconRect.height) {
      ctx.font = `${iconRect.height}px ${pen.iconFamily}`;
    } else {
      ctx.font = `${iconRect.width}px ${pen.iconFamily}`;
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

    ctx.font = `${pen.fontStyle || 'normal'} normal ${pen.fontWeight || 'normal'} ${pen.fontSize}px/${pen.lineHeight} ${
      pen.fontFamily
    }`;

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
        pen.calculative.textDrawRect.y + (i + y) * pen.fontSize * pen.lineHeight
      );
    });

    ctx.restore();
  }

  ctx.restore();
}

export function renderLineAnchors(ctx: CanvasRenderingContext2D, pen: Pen, store: TopologyStore) {
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

export function calcWorldRects(store: TopologyStore, pen: Pen) {
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
      parentRect = calcWorldRects(store, store.pens[pen.parentId]);
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

  return rect;
}

export function calcPenRect(store: TopologyStore, pen: Pen) {
  if (!pen.parentId) {
    pen.x = pen.calculative.worldRect.x;
    pen.y = pen.calculative.worldRect.y;
    pen.width = pen.calculative.worldRect.width;
    pen.height = pen.calculative.worldRect.height;
    return;
  }

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
  let x = pen.calculative.iconLeft || 0;
  let y = pen.calculative.iconTop || 0;
  let width = pen.calculative.iconWidth || pen.calculative.worldRect.width;
  let height = pen.calculative.iconHeight || pen.calculative.worldRect.height;
  if (x && Math.abs(x) < 1) {
    x = pen.calculative.worldRect.width * pen.calculative.iconLeft;
  }

  if (y && Math.abs(y) < 1) {
    y = pen.calculative.worldRect.height * pen.calculative.iconLeft;
  }
  if (width && Math.abs(width) < 1) {
    width = pen.calculative.worldRect.width * pen.calculative.iconWidth;
  }

  if (height && Math.abs(height) < 1) {
    height = pen.calculative.worldRect.height * pen.calculative.iconHeight;
  }

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
  if (!pen.lineWidth) {
    pen.lineWidth = 1;
  }
  pen.calculative.lineWidth = pen.lineWidth * scale;
  pen.calculative.lineHeight = pen.lineHeight * scale;
  pen.calculative.fontSize = pen.fontSize * scale;
  pen.calculative.iconSize = pen.iconSize * scale;
  pen.calculative.iconWidth = pen.iconWidth * scale;
  pen.calculative.iconHeight = pen.iconHeight * scale;
  pen.calculative.iconLeft = pen.iconLeft * scale;
  pen.calculative.iconTop = pen.iconTop * scale;
  pen.calculative.textWidth = pen.textWidth * scale;
  pen.calculative.textHeight = pen.textHeight * scale;
  pen.calculative.textLeft = pen.textLeft * scale;
  pen.calculative.textTop = pen.textTop * scale;
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
      x: pen.frames[pen.calculative.frameIndex].x,
      y: pen.frames[pen.calculative.frameIndex].y,
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
      } else if (typeof frame[k] === 'number' && pen.linear !== false) {
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

export function setChildrenActive(store: TopologyStore, pen: Pen, active = true) {
  if (!pen.children) {
    return;
  }

  pen.children.forEach((id) => {
    const child: Pen = store.pens[id];
    child.calculative.active = active;

    setChildrenActive(store, child);
  });
}

export function setHover(store: TopologyStore, pen: Pen, hover = true) {
  if (!pen) {
    return;
  }

  pen.calculative.hover = hover;
  if (pen.children) {
    pen.children.forEach((id) => {
      setHover(store, store.pens[id], hover);
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
  elem.style.display = pen.visible !== false ? 'inline' : 'none'; // 是否隐藏元素
  if (pen.rotate) {
    elem.style.transform = `rotate(${pen.rotate}deg)`;
  }
  if (pen.locked || store.data.locked) {
    elem.style.userSelect = 'initial';
    elem.style.pointerEvents = 'initial';
  } else {
    elem.style.userSelect = 'none';
    elem.style.pointerEvents = 'none';
  }
}
