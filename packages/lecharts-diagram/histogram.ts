import { coordinateAxis } from './coordinateAxis';

//折线图
export function histogram(ctx: CanvasRenderingContext2D, pen: any) {
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;
  let series = pen.option.series;

  let coordinate = coordinateAxis(ctx, pen);
  let dash = coordinate.dash;
  let normalizedOption = coordinate.normalizedOption;
}
