import { Pen } from '../pen';

export function rectangle(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  if(!pen.setTheme){
    pen.setTheme = setTheme;
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
  path.closePath();
  if (path instanceof Path2D) {
    return path;
  }
}
function setTheme(pen:any,styles:any){
  if(!pen.affectByTheme){
    return;
  }
  for (const key in styles) {
    if (Object.prototype.hasOwnProperty.call(styles, key)) {
      const element = styles[key];
        if(pen.hasOwnProperty(key)){
          pen[key] = element;
        }
        if(pen.calculative.hasOwnProperty(key)){
          pen.calculative[key] = element;
        }
    }
  }
  pen.hoverTextColor = styles["textPrimaryColor"];
  pen.iconColor = styles["textPrimaryColor"];
  pen.hoverBackground = styles["formBg"];
  pen.activeBackground = styles["activeBg"];
}
export const square = rectangle;
