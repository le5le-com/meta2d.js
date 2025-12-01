import { Pen, setElemPosition } from '../pen';
import { Point } from '../point';
import { getMeta2dData, s8, debounce, deepClone } from '../utils';

export function sceneContainer(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  if (!pen.onDestroy) {
    pen.onAdd = add;
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onBeforeValue = beforeValue;
    pen.onMouseDown = onMousedown;
    pen.onMouseUp = onMouseUp;
  }
  const path = !ctx ? new Path2D() : ctx;

  if (path instanceof Path2D) return path;
}

async function add(pen: any) {
  if (!pen.sceneId) {
    pen.sceneId = s8();
  }
}

const getContainerPens = async (pen: any, vId?: string) => {
  const store = pen.calculative.canvas.store;
  const origin = store.data.origin;
  const scale = store.data.scale;
  const _vId = vId || pen.vId;
  const data = await getMeta2dData(store, _vId);
  if (data && data.pens?.length) {
    const c_scale = data.scale;
    const c_origin = data.origin;
    data.pens.forEach((cpen: any) => {
      if (!cpen.parentId) {
        cpen.width = cpen.width / c_scale;
        cpen.height = cpen.height / c_scale;
        cpen.x = (cpen.x - c_origin.x) / c_scale + (pen.x - origin.x) / scale;
        cpen.y = (cpen.y - c_origin.y) / c_scale + (pen.y - origin.y) / scale;
      }
      if (!cpen.p_sceneId) {
        cpen.p_sceneId = pen.sceneId;
        if (cpen.name !== 'sceneContainer') {
          cpen.p_vId = _vId;
        }
      }
    });

    const meta2d = pen.calculative.canvas.parent;
    meta2d.addPens(data.pens, false, true);
  }

  moveToLast(pen);
};

const deleteContainerPens = (pen: Pen) => {
  const meta2d = pen.calculative.canvas.parent;
  let pens = collectContainerPens(pen);
  pens.forEach((cpen: Pen) => {
    meta2d.canvas.delForce(cpen);
  });

  meta2d.canvas.canvasTemplate.init();
  meta2d.canvas.canvasImage.init();
  meta2d.canvas.canvasImageBottom.init();
  meta2d.render();
};

const collectContainerPens = (pen: any) => {
  let pens = [];
  const meta2d = pen.calculative.canvas.parent;

  meta2d.store.data.pens.forEach((cpen: any) => {
    if (
      cpen.p_sceneId &&
      pen.sceneId &&
      cpen.p_sceneId === pen.sceneId &&
      cpen.id !== pen.id
    ) {
      cpen.calculative.locked = 0;
      cpen.locked = 0;
      pens.push(cpen);
    }
  });
  return pens;
};

const translateContainerPens = async (pen: any) => {
  if (pen.calculative.drag && pen.calculative.active && !(pen.locked > 1)) {
    pen.calculative.drag = false;
    deleteContainerPens(pen);
    getContainerPens(pen);
  }
};

function destory(pen: Pen) {
  deleteContainerPens(pen);
}

function beforeValue(pen: Pen, value: any) {
  if (value.vId) {
    deleteContainerPens(pen);
    getContainerPens(pen, value.vId);
  }
  if (value.x !== undefined || value.y !== undefined) {
    deleteContainerPens(pen);
    getContainerPens(pen);
  }
  return value;
}

function move(pen: Pen) {
  debounce(translateContainerPens, 500, pen);
}

function onMousedown(pen: any, e: Point) {
  pen.calculative.drag = true;
}

function onMouseUp(pen: any, e: Point) {
  pen.calculative.drag = false;
}

function moveToLast(pen) {
  let array = pen.calculative.canvas.store.data.pens;
  let index = array.findIndex((item) => item.id === pen.id);

  if (index < 0 || index >= array.length) return array;

  const element = array.splice(index, 1)[0];
  array.push(element);
}
