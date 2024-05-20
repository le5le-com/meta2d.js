import { movingSuffix } from '../canvas';
import { Pen } from '../pen';
import { Point } from '../point';
import { rectInRect } from '../rect';
import { deepClone } from '../utils';

export function panel(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onRotate = move;
    pen.onMouseEnter = mouseEnter;
    pen.onMouseLeave = mouseLeave;
    pen.onMouseMove = mouseMove;
    pen.onMouseUp = mouseUp;
  }
  let wr = pen.calculative.borderRadius || 0,
    hr = wr;
  const { x, y, width, height, ex, ey } = pen.calculative.worldRect;
  if (wr < 1) {
    wr = width * wr;
    hr = height * hr;
  }
  let r = wr < hr ? wr : hr;
  if (width < 2 * r) {
    r = width / 2;
  }
  if (height < 2 * r) {
    r = height / 2;
  }

  path.moveTo(x + r, y);
  path.arcTo(ex, y, ex, ey, r);
  path.arcTo(ex, ey, x, ey, r);
  path.arcTo(x, ey, x, y, r);
  path.arcTo(x, y, ex, y, r);
  if (path instanceof Path2D) {
    return path;
  }
}

function destory(pen: Pen) {}

function move(pen: Pen) {}

function mouseEnter(pen: Pen) {
  // const activePens = pen.calculative.canvas.store.active;
  // if(activePens&&activePens.length){
  //   activePens.forEach((activePen:Pen)=>{
  //     if(rectInRect(activePen.calculative.worldRect,pen.calculative.worldRect,true)){
  //       if(!pen.followers){
  //         pen.followers =[];
  //       }
  //       if(!pen.followers.includes(activePen.id)){
  //         pen.followers.push(activePen.id);
  //       }
  //     }
  //   })
  // }
}

function mouseLeave(pen: Pen) {
  const activePens = pen.calculative.canvas.store.active;
  if (activePens && activePens.length) {
    activePens.forEach((activePen: Pen) => {
      // if(!rectInRect(activePen.calculative.worldRect,pen.calculative.worldRect,true)){
      //   if(!pen.followers){
      //     pen.followers =[];
      //   }
      //   if(!pen.followers.includes(activePen.id)){
      //     pen.followers.push(activePen.id);
      //   }
      // }
      if (pen.followers) {
        let idx = pen.followers.findIndex((id: string) => id === activePen.id);
        if (idx !== -1) {
          const movingPen =
            pen.calculative.canvas.store.pens[activePen.id + movingSuffix];
          if (movingPen && movingPen.calculative) {
            let isIn = rectInRect(
              movingPen.calculative.worldRect,
              pen.calculative.worldRect,
              true
            );
            if (!isIn) {
              pen.followers.splice(idx, 1);
            }
          }
        }
      }
    });
  }
}

function mouseUp(pen: Pen) {
  const activePens = pen.calculative.canvas.store.active;
  if (activePens && activePens.length) {
    activePens.forEach((activePen: Pen) => {
      const movingPen =
        pen.calculative.canvas.store.pens[activePen.id + movingSuffix];
      if (movingPen && movingPen.calculative) {
        if (
          rectInRect(
            movingPen.calculative.worldRect,
            pen.calculative.worldRect,
            true
          )
        ) {
          if (!pen.followers) {
            pen.followers = [];
          }
          if (!pen.followers.includes(activePen.id)) {
            pen.followers.push(activePen.id);
          }
        }
      }
    });
  }
}

function mouseMove(pen: Pen, e: Point) {
  //  console.log(e,pen.calculative.canvas.store.active);
}
