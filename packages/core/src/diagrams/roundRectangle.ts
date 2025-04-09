import { Pen } from '../pen';
import { round } from '../utils/math';

export function roundRectangle(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const { x, y, width, height } = pen.calculative.worldRect;
  // lt rt rb lb
  const radius = pen.borderRadius || [0, 0, 0, 0];
  const arr = radius.map(r=>{
    if(r >= 0){
      return  round(r * 100,2);
    }else {
      return round(r,2);
    }
  })
  // console.log('kkk',arr)
  const pathStr = roundRect(x, y, width, height, arr)
  const path = new Path2D(pathStr);
  return path;
}
function roundRect(x, y, w, h, radius) {
  const tr = radius[1], tl = radius[0], br = radius[2], bl = radius[3];
  return `M${x + tl},${y}\
    h${w - (tl + tr)}\
    a${tr},${tr} 0 0 1 ${tr},${tr}\
    v${h - (tr + br)}\
    a${br},${br} 0 0 1 -${br},${br}\
    h-${w - (bl + br)}\
    a${bl},${bl} 0 0 1 -${bl},-${bl}\
    v-${h - (tl + bl)}\
    a${tl},${tl} 0 0 1 ${tl},-${tl}\
    z`.replace(/\s\s+/g, ' ').replace(',', ', ');
}