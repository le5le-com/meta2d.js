import { movingSuffix } from '../canvas';
import { Pen } from '../pen';
import { Point } from '../point';
import { rectInRect } from '../rect';
import { deepClone } from '../utils';

export function form(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onRotate = move;
    pen.onMouseEnter = mouseEnter;
    pen.onMouseLeave = mouseLeave;
    pen.onMouseMove = mouseMove;
    pen.onMouseUp = mouseUp;
    pen.onInput = input;
  }
  pen.formId = pen.id;
  let wr = pen.calculative.borderRadius || 0,
    hr = wr;
  const { x, y, width, height, ex, ey } = pen.calculative.worldRect;
  const { x: textX } = pen.calculative.worldTextRect;
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
  // let textWidth = -5;
  // if(pen.text){
  //   textWidth = getTextWidth(pen.text, pen.calculative.fontSize);
  // }
  path.moveTo(x + r, y);
  // path.lineTo(textX - 5, y);
  // path.moveTo(textX + textWidth + 5, y);
  // path.lineTo(textX + textWidth + 5, y);
  path.arcTo(ex, y, ex, ey, r);
  path.arcTo(ex, ey, x, ey, r);
  path.arcTo(x, ey, x, y, r);
  path.arcTo(x, y, ex, y, r);
  if (path instanceof Path2D) {
    return path;
  }
}

function getTextWidth(text: string, fontSize: number) {
  // 近似计算
  const chinese = text.match(/[^\x00-\xff]/g) || '';
  const chineseWidth = chinese.length * fontSize; // 中文占用的宽度
  const spaces = text.match(/\s/g) || '';
  const spaceWidth = spaces.length * fontSize * 0.3; // 空格占用的宽度
  const otherWidth =
    (text.length - chinese.length - spaces.length) * fontSize * 0.6; // 其他字符占用的宽度
  const currentWidth = chineseWidth + spaceWidth + otherWidth;
  return currentWidth;
}

function input(pen: Pen, text: string) {
  pen.text = text;
  pen.calculative.text = pen.text;
  // this.inputDiv.dataset.penId = undefined;
  pen.calculative.canvas.updatePenRect(pen);
  // this.patchFlags = true;
  // this.store.emitter.emit('valueUpdate', pen);
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
              delete activePen.formId;
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
        let inRect = deepClone(pen.calculative.worldRect);
        inRect.x -= 1;
        inRect.y -= 1;
        inRect.width += 2;
        inRect.height += 2;
        if (rectInRect(movingPen.calculative.worldRect, inRect, true)) {
          if (!pen.followers) {
            pen.followers = [];
          }
          if (!pen.followers.includes(activePen.id)) {
            pen.followers.push(activePen.id);
          }
          activePen.formId = pen.id;
        }
      }
    });
  }
}

function mouseMove(pen: Pen, e: Point) {
  //  console.log(e,pen.calculative.canvas.store.active);
}

//更新表单数据
export function updateFormData(pen, key?:string){
  if(pen.formId && pen.formKey && pen.formValue){
    //表单图元更新值
    const leaderPen = pen.calculative.canvas.store.pens[pen.formId];
    if(leaderPen){
      if(!leaderPen.formData){
        leaderPen.formData = {};
      }
      leaderPen.formData[pen.formKey] = pen[pen.formValue];
    }
  }
}

//提交表单
export function submit(pen:Pen){
}

//重置表单
export function reset(pen:Pen){
  const formPen = pen.calculative.canvas.store.pens[pen.formId];
  formPen.followers.forEach((id:string)=>{
    const follower = pen.calculative.canvas.store.pens[id];
    if(follower.formId && follower.formKey && formPen.formData[follower.formKey]){
      const value = follower[follower.formValue];
      let data:any = '';
      if(Array.isArray(value)){
        data = [];
      }
      // follower[follower.formValue] = data;
      // follower.calculative[follower.formValue] = data;
      pen.calculative.canvas.parent.setValue({id:follower.id,[follower.formValue]:data},{render:false,doEvent:false,history:false});
    }
  });
  formPen.formData = {};
  pen.calculative.canvas.parent.render();
}