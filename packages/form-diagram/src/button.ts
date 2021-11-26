declare const window: any;
import { Pen } from '../../core/src/pen';

export function button(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!pen.onDestroy) {
    pen.onClick = click;
  }
  if (!path) {
    path = new Path2D();
  }
  let wr = pen.calculative.borderRadius || 0;
  let hr = pen.calculative.borderRadius || 0;
  if (wr < 1) {
    wr = pen.calculative.worldRect.width * wr;
    hr = pen.calculative.worldRect.height * hr;
  }
  let r = wr < hr ? wr : hr;
  if (pen.calculative.worldRect.width < 2 * r) {
    r = pen.calculative.worldRect.width / 2;
  }
  if (pen.calculative.worldRect.height < 2 * r) {
    r = pen.calculative.worldRect.height / 2;
  }

  path.moveTo(pen.calculative.worldRect.x + r, pen.calculative.worldRect.y);
  path.arcTo(
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.ey,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.ey,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.ey,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.ey,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.y,
    r
  );
  return path;
}

function click(pen: any) {
  let temStyle = pen.background;
  console.log(pen.background);
  pen.background = pen.pressColor;
  pen.calculative.background = pen.pressColor;
  pen.calculative.canvas.parent.setValue(pen);
  window.setTimeout(() => {
    pen.calculative.background = temStyle;
    pen.background = temStyle;
    pen.calculative.canvas.parent.setValue(pen);
  }, 100);
}
