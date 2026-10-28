import { Pen } from '../../models';
// 在图元编辑器中，把circle的绘制方式从ellipse命令改为使用贝塞尔曲线绘制，
// 从而让绘制出来的圆的path不包含A命令，而是C命令，并且有Z命令，是闭合路径
// 这样就不会出现首次编辑圆的path时，path严重错位的问题
export function circle(ctx: CanvasRenderingContext2D, pen: Pen) {
  ctx.beginPath();
  const { x, y, width, height } = pen;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  // 椭圆的半宽和半高
  const rx = width / 2;
  const ry = height / 2;

  // 贝塞尔曲线控制点系数（椭圆的最佳逼近值）
  const k = 0.5522847498; // 4 * (Math.sqrt(2) - 1) / 3

  // 从椭圆最右侧点开始，顺时针绘制四段贝塞尔曲线
  ctx.moveTo(centerX + rx, centerY); // 起点：右顶点
  // 右上四分之一椭圆
  ctx.bezierCurveTo(
    centerX + rx,
    centerY - ry * k, // 第一个控制点
    centerX + rx * k,
    centerY - ry, // 第二个控制点
    centerX,
    centerY - ry // 终点：上顶点
  );
  // 左上四分之一椭圆
  ctx.bezierCurveTo(
    centerX - rx * k,
    centerY - ry, // 第一个控制点
    centerX - rx,
    centerY - ry * k, // 第二个控制点
    centerX - rx,
    centerY // 终点：左顶点
  );
  // 左下四分之一椭圆
  ctx.bezierCurveTo(
    centerX - rx,
    centerY + ry * k, // 第一个控制点
    centerX - rx * k,
    centerY + ry, // 第二个控制点
    centerX,
    centerY + ry // 终点：下顶点
  );
  // 右下四分之一椭圆
  ctx.bezierCurveTo(
    centerX + rx * k,
    centerY + ry, // 第一个控制点
    centerX + rx,
    centerY + ry * k, // 第二个控制点
    centerX + rx,
    centerY // 终点：右顶点（闭合）
  );
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
