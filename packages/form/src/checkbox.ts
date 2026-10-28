import type { Meta2d, Pen } from '@meta2d/core';
import { deepClone } from '@meta2d/core/src/utils/object';

type ComponentPen = Pen & Record<string, unknown>;

export const checkboxDefine = {
  type: 'checkbox',
  draw: checkbox,
  beforeUpdate: checkboxBeforeUpdate,
  mouseDown: checkboxMouseDown,
};

interface ChoiceHit { key: unknown; disabled: boolean; x: number; y: number; width: number; height: number }

type MeasureText = (text: string) => number;

function getChoiceHits(pen: ComponentPen, measureText: MeasureText): ChoiceHit[] {
  const box = rect(pen);
  const data = normalizeData({ ...pen, data: pen.data || pen.options });
  const vertical = pen.direction === 'vertical';
  const gap = Math.max(6, Number(pen.gap || 10));
  const fontSize = Math.max(10, Number(pen.fontSize) || 14);
  const hits: ChoiceHit[] = [];
  let cursor = vertical ? box.y : box.x;
  data.forEach((item, index) => {
    const key = item.key ?? item.value ?? index;
    const disabled = Boolean(pen.disabled || item.isForbidden || item.disabled);
    const label = String(item.text ?? item.label ?? key);
    const width = vertical
      ? box.width
      : Math.max(54, measureText(label) + fontSize + gap * 2);
    const height = vertical ? box.height / Math.max(1, data.length) : box.height;
    const x = vertical ? box.x : cursor;
    const y = vertical ? cursor : box.y;
    hits.push({ key, disabled, x, y, width, height });
    cursor += (vertical ? height : width) + (vertical ? 0 : gap);
  });

  return hits;
}

function createTextMeasurer(pen: ComponentPen): MeasureText {
  if (typeof document !== 'undefined') {
    const context = document.createElement('canvas').getContext('2d');
    if (context) {
      context.font = font(pen);
      return (text) => context.measureText(text).width;
    }
  }

  const fontSize = Math.max(10, Number(pen.fontSize) || 14);
  return (text) => text.length * fontSize;
}

export function checkbox(ctx: CanvasRenderingContext2D, pen: ComponentPen) {
  const data = normalizeData({ ...pen, data: pen.data || pen.options });
  const selected = Array.isArray(pen.selectedKeys) ? pen.selectedKeys
    : Array.isArray(pen.checked) ? pen.checked : [];
  const button = pen.theme === 'button';
  const gap = Math.max(6, Number(pen.gap || 10));
  ctx.font = font(pen);
  const hits = getChoiceHits(pen, (text) => ctx.measureText(text).width);
  data.forEach((item, index) => {
    const { key, disabled, x, y, width, height } = hits[index];
    const active = selected.includes(key);
    if (button) {
      roundRect(ctx, x, y, width, height, Number(pen.borderRadius || 3));
      ctx.fillStyle = active ? String(pen.activeBackground || '#4583ff33') : String(pen.background || 'transparent');
      ctx.fill();
      ctx.strokeStyle = active ? String(pen.activeColor || '#4583ff') : String(pen.color || '#64748b');
      ctx.stroke();
      drawText(ctx, item.text ?? item.label ?? key, x + width / 2, y + height / 2, {
        ...pen,
        textColor: disabled ? String(pen.disabledTextColor || '#64748b') : active ? String(pen.activeTextColor || '#fff') : pen.textColor,
      });
    } else {
      const size = Math.max(10, pen.fontSize || 14);
      const sx = x + 2;
      const sy = y + (height - size) / 2;
      roundRect(ctx, sx, sy, size, size, 2);
      ctx.fillStyle = active ? String(pen.activeBackground || '#4583ff') : 'transparent';
      ctx.fill();
      ctx.strokeStyle = active ? String(pen.activeBackground || '#4583ff') : String(pen.color || '#64748b');
      ctx.stroke();
      if (active) {
        ctx.beginPath();
        ctx.moveTo(sx + size * 0.2, sy + size * 0.5);
        ctx.lineTo(sx + size * 0.42, sy + size * 0.75);
        ctx.lineTo(sx + size * 0.82, sy + size * 0.25);
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
      drawText(ctx, item.text ?? item.label ?? key, sx + size + gap, y + height / 2, {
        ...pen,
        textColor: disabled ? String(pen.disabledTextColor || '#64748b') : pen.textColor,
      }, 'left');
    }
  });
}

export function checkboxBeforeUpdate(pen: ComponentPen, oldPen: ComponentPen) {
  return syncPenData(pen, oldPen);
}

export function checkboxMouseDown(this: Meta2d, source: ComponentPen, event: unknown) {
  const pen = currentPen(this, source);
  if (!pen.id || pen.disabled) return false;
  // 绘制在 Worker 中执行，主线程不能读取 Worker 内存，因此点击时必须重新计算布局。
  const hits = getChoiceHits(pen, createTextMeasurer(pen));
  const hit = hits.find((item) => pointInRect(event as { x?: number; y?: number }, item));
  if (!hit || hit.disabled) return false;
  const selected = Array.isArray(pen.selectedKeys) ? [...pen.selectedKeys]
    : Array.isArray(pen.checked) ? [...pen.checked] : [];
  const index = selected.indexOf(hit.key);
  index >= 0 ? selected.splice(index, 1) : selected.push(hit.key);
  setPenValue(this, pen, { selectedKeys: selected, checked: selected, value: selected });
  return false;
}

function rect(pen: ComponentPen) {
  return {
    x: pen.x || 0,
    y: pen.y || 0,
    width: pen.width || 0,
    height: pen.height || 0,
  };
}

function font(pen: ComponentPen, size = pen.fontSize || 14) {
  return (
    (pen.fontStyle || '') +
    ' ' +
    (pen.fontWeight || '') +
    ' ' +
    size +
    'px ' +
    (pen.fontFamily || 'Arial')
  ).trim();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  value: unknown,
  x: number,
  y: number,
  pen: ComponentPen,
  align: CanvasTextAlign = 'center',
) {
  ctx.save();
  ctx.font = font(pen);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pen.textColor || pen.color || '#d9e2f2';
  ctx.fillText(String(value ?? ''), x, y);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 4,
) {
  const finalRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + finalRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, finalRadius);
  ctx.arcTo(x + width, y + height, x, y + height, finalRadius);
  ctx.arcTo(x, y + height, x, y, finalRadius);
  ctx.arcTo(x, y, x + width, y, finalRadius);
  ctx.closePath();
}

function normalizeData(pen: ComponentPen): Array<Record<string, unknown>> {
  const data = pen.data;
  return Array.isArray(data)
    ? data.map((item) =>
        typeof item === 'object' && item !== null
          ? (item as Record<string, unknown>)
          : { value: item },
      )
    : [];
}

function pointInRect(
  point: { x?: number; y?: number },
  target: { x: number; y: number; width: number; height: number },
) {
  const x = point.x ?? Number.NaN;
  const y = point.y ?? Number.NaN;
  return x >= target.x && x <= target.x + target.width && y >= target.y && y <= target.y + target.height;
}

function currentPen(meta2d: Meta2d, sourcePen: ComponentPen) {
  return (meta2d.penMap.get(sourcePen.id || '') || sourcePen) as ComponentPen;
}

function setPenValue(
  meta2d: Meta2d,
  pen: ComponentPen,
  value: Record<string, unknown>,
  preventEvent = false,
) {
  if (!pen.id) {
    return;
  }
  meta2d.setValue({ id: pen.id, ...value }, { preventEvent });
}

function syncPenData(pen: ComponentPen, oldPen: ComponentPen) {
  const increment = pen.__val as Record<string, unknown> | undefined;
  // beforeUpdate 接收到的是增量 Pen，未包含的业务字段必须从当前 Pen 补齐。
  for (const [key, value] of Object.entries(oldPen || {})) {
    if (pen[key] === undefined && key !== '__val') {
      pen[key] = value;
    }
  }
  if (increment) {
    for (const [key, value] of Object.entries(increment)) {
      pen[key] =
        Array.isArray(value) || (typeof value === 'object' && value !== null)
          ? deepClone(value)
          : value;
    }
  }
  if (pen.data !== undefined) {
    pen.data = deepClone(pen.data);
  }
  return true;
}
