export function watermeter(pen: any) {
  if (!pen.calculative || !pen.calculative.worldRect) {
     return;
  }
  const path = new Path2D();
  // 绘制圆形
  drawCircle(path, pen);
  // 绘制波浪
  drawSin(path, pen);
  path.closePath();
  return path;
}
// 绘制圆形
function drawCircle(path: Path2D, pen: any) {
    const R = pen.calculative.worldRect.width > pen.calculative.worldRect.height ? pen.calculative.worldRect.height : pen.calculative.worldRect.width;
    const lR = pen.calculative.worldRect.width > pen.calculative.worldRect.height ? pen.calculative.worldRect.width : pen.calculative.worldRect.height;
    const r = Math.floor(R / 2);
    const lineWidth = 2;
    let x = pen.calculative.worldRect.x;
    let y = pen.calculative.worldRect.y;
    const cR = r - lineWidth / 2;
    pen.lineWidth = lineWidth;
    let xR, yR;
    if (pen.calculative.worldRect.width > pen.calculative.worldRect.height) {
      xR = x + lR / 2;
      yR = y + r;
    } else if (pen.calculative.worldRect.width < pen.calculative.worldRect.height) {
      xR = x + r;
      yR = y + lR / 2;
    } else {
      xR = x + r;
      yR = y + r;
    }

    path.moveTo(xR+cR, yR)
    path.arc(xR, yR, cR, 0, 2 * Math.PI);
    path.closePath()
  }
  // 绘制波浪
  function drawSin(path: Path2D, pen: any) {
    const points = [];
    const width = pen.calculative.worldRect.width;
    const height = pen.calculative.worldRect.height;
    const lR = width > height ? width : height;
    const R = width > height ? height-4 : width-4;
    let canvasWidth, canvasHeight;
    if (width >= height) {
      canvasWidth = lR;
      canvasHeight = R;
    } else {
      canvasWidth = R;
      canvasHeight = lR;
    }
  
    const waveWidth = 0.2; //波浪宽度,数越小越宽
    const waveHeight = 1; //波浪高度,数越大越高
    const xOffset = Math.floor(Math.random() * 10); //水平位移
    const yOffset = (pen.data.value / 100) * R; //垂直位移
  
    let leftx = 0;
    let lefty = 0;
    let rightx = 0;
    let righty = 0;
    let absAngle = 0;
    let abs = Math.abs(yOffset - R / 2);
    if (yOffset / (R / 2) >= 1) {
      leftx = pen.calculative.worldRect.x + width / 2 - Math.sqrt((R / 2) * (R / 2)  - abs * abs);
      lefty = righty = pen.calculative.worldRect.y + height / 2 - abs;
      rightx = pen.calculative.worldRect.x + width / 2 + Math.sqrt((R / 2) * (R / 2) - abs * abs);
      absAngle = Math.asin(abs/(R / 2));
    } else {
      leftx = pen.calculative.worldRect.x + width / 2 - Math.sqrt((R / 2) * (R / 2)  - abs * abs);
      lefty = righty = pen.calculative.worldRect.y + height / 2 + abs;
      rightx = pen.calculative.worldRect.x + width / 2 + Math.sqrt((R / 2) * (R / 2)  - abs * abs);
      absAngle = -Math.asin(abs/(R / 2));
    }
   path.arc(pen.calculative.worldRect.x + width / 2,pen.calculative.worldRect.y + height / 2 ,R/2,-absAngle,Math.PI+absAngle);
    
    for (let x = leftx; x < rightx; x += 20 / (rightx-leftx)) {
      const y =
        waveHeight * Math.sin((leftx + x) * waveWidth + xOffset) +
        pen.calculative.worldRect.y +
        R / 2 -
        yOffset;
      points.push([x, canvasHeight / 2 + y]);
      path.lineTo(x, canvasHeight / 2 + y);
    }
  }

  //绘制水位线
  export function watermeterScaleByCtx(ctx: CanvasRenderingContext2D, pen: any) {
    const x = pen.calculative.worldRect.x;
    const y = pen.calculative.worldRect.y;
    const width = pen.calculative.worldRect.width;
    const height = pen.calculative.worldRect.height;
    const lR = width > height ? width : height;
    const R = width > height ? height : width;
    const r = Math.floor(R / 2);
    const scaleLineWidth = 7; //刻度每一个字符线宽
    const canvasHeight = R;
    const maxValue = pen.data.max;
    const minValue = pen.data.min;
    let minY, minl, minX;
    let maxY, maxl, maxX;
    let deltaX = 0; // min和max的X坐标差
    if (minValue) {
      if (width > height) {
        minY = Math.abs(
          y + ((100 - minValue) / 100) * canvasHeight - (y + canvasHeight / 2)
        );
        minl = Math.sqrt(Math.pow(r, 2) - Math.pow(minY, 2));
        minX = r - minl + x + lR / 2 - R / 2;
      } else if (width < height) {
        minY = Math.abs(
          y + ((100 - minValue) / 100) * canvasHeight - (y + canvasHeight / 2)
        );
        minl = Math.sqrt(Math.pow(r, 2) - Math.pow(minY, 2));
        minX = r - minl + x;
      } else {
        minY = Math.abs(
          y + ((100 - minValue) / 100) * canvasHeight - (y + canvasHeight / 2)
        );
        minl = Math.sqrt(Math.pow(r, 2) - Math.pow(minY, 2));
        minX = r - minl + x;
      }
    }
    if (maxValue) {
      if (width > height) {
        maxY = Math.abs(
          y + ((100 - maxValue) / 100) * canvasHeight - (y + canvasHeight / 2)
        );
        maxl = Math.sqrt(Math.pow(r, 2) - Math.pow(maxY, 2));
        maxX = r - maxl + x + lR / 2 - R / 2;
      } else if (width < height) {
        maxY = Math.abs(
          y + ((100 - maxValue) / 100) * canvasHeight - (y + canvasHeight / 2)
        );
        maxl = Math.sqrt(Math.pow(r, 2) - Math.pow(maxY, 2));
        maxX = r - maxl + x;
      } else {
        maxY = Math.abs(
          y + ((100 - maxValue) / 100) * canvasHeight - (y + canvasHeight / 2)
        );
        maxl = Math.sqrt(Math.pow(r, 2) - Math.pow(maxY, 2));
        maxX = r - maxl + x;
      }
    }
  
    ctx.beginPath();
    ctx.fillStyle = '#000';
    ctx.font = 'normal 12px Arial';
    // 最大值和最小值都存在
    if (minValue && maxValue) {
      if (minX > maxX) {
        deltaX = minX - maxX;
  
        if (width >= height) {
          ctx.moveTo(minX, y + ((100 - minValue) / 100) * canvasHeight);
          ctx.lineTo(
            minX - scaleLineWidth - deltaX,
            y + ((100 - minValue) / 100) * canvasHeight
          );
          ctx.direction = 'rtl';
          ctx.fillText(
            pen.data.minText,
            minX - scaleLineWidth - deltaX,
            y + ((100 - minValue) / 100) * canvasHeight + 3
          );
          ctx.fillText(
            minValue,
            minX - scaleLineWidth - deltaX,
            y + ((100 - minValue) / 100) * canvasHeight + 15
          );
  
          ctx.moveTo(maxX, y + ((100 - maxValue) / 100) * canvasHeight);
          ctx.lineTo(
            maxX - scaleLineWidth,
            y + ((100 - maxValue) / 100) * canvasHeight
          );
          ctx.direction = 'rtl';
          ctx.fillText(
            pen.data.maxText,
            maxX - scaleLineWidth,
            y + ((100 - maxValue) / 100) * canvasHeight + 3
          );
          ctx.fillText(
            maxValue,
            maxX - scaleLineWidth,
            y + ((100 - maxValue) / 100) * canvasHeight + 15
          );
        } else {
          ctx.moveTo(
            minX,
            y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2
          );
          ctx.lineTo(
            minX - scaleLineWidth - deltaX,
            y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2
          );
          ctx.direction = 'rtl';
          ctx.fillText(
            pen.data.minText,
            minX - scaleLineWidth - deltaX,
            y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3
          );
          ctx.fillText(
            minValue,
            minX - scaleLineWidth - deltaX,
            y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15
          );
  
          ctx.moveTo(
            maxX,
            y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2
          );
          ctx.lineTo(
            maxX - scaleLineWidth,
            y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2
          );
          ctx.direction = 'rtl';
          ctx.fillText(
            pen.data.maxText,
            maxX - scaleLineWidth,
            y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3
          );
          ctx.fillText(
            maxValue,
            maxX - scaleLineWidth,
            y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15
          );
        }
      } else {
        deltaX = maxX - minX;
        if (width >= height) {
          ctx.moveTo(minX, y + ((100 - minValue) / 100) * canvasHeight);
          ctx.lineTo(
            minX - scaleLineWidth,
            y + ((100 - minValue) / 100) * canvasHeight
          );
          ctx.direction = 'rtl';
          ctx.fillText(
            pen.data.minText,
            minX - scaleLineWidth,
            y + ((100 - minValue) / 100) * canvasHeight + 3
          );
          ctx.fillText(
            minValue,
            minX - scaleLineWidth,
            y + ((100 - minValue) / 100) * canvasHeight + 15
          );
  
          ctx.moveTo(maxX, y + ((100 - maxValue) / 100) * canvasHeight);
          ctx.lineTo(
            maxX - scaleLineWidth - deltaX,
            y + ((100 - maxValue) / 100) * canvasHeight
          );
          ctx.direction = 'rtl';
          ctx.fillText(
            pen.data.maxText,
            maxX - scaleLineWidth - deltaX,
            y + ((100 - maxValue) / 100) * canvasHeight + 3
          );
          ctx.fillText(
            maxValue,
            maxX - scaleLineWidth - deltaX,
            y + ((100 - maxValue) / 100) * canvasHeight + 15
          );
        } else {
          ctx.moveTo(
            minX,
            y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2
          );
          ctx.lineTo(
            minX - scaleLineWidth,
            y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2
          );
          ctx.direction = 'rtl';
          ctx.fillText(
            pen.data.minText,
            minX - scaleLineWidth,
            y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3
          );
          ctx.fillText(
            minValue,
            minX - scaleLineWidth,
            y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15
          );
  
          ctx.moveTo(
            maxX,
            y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2
          );
          ctx.lineTo(
            maxX - scaleLineWidth - deltaX,
            y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2
          );
          ctx.direction = 'rtl';
          ctx.fillText(
            pen.data.maxText,
            maxX - scaleLineWidth - deltaX,
            y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3
          );
          ctx.fillText(
            maxValue,
            maxX - scaleLineWidth - deltaX,
            y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15
          );
        }
      }
    } else if (minValue && !maxValue) {
      if (width >= height) {
        ctx.moveTo(minX, y + ((100 - minValue) / 100) * canvasHeight);
        ctx.lineTo(
          minX - scaleLineWidth,
          y + ((100 - minValue) / 100) * canvasHeight
        );
        ctx.direction = 'rtl';
        ctx.fillText(
          pen.data.minText,
          minX - scaleLineWidth,
          y + ((100 - minValue) / 100) * canvasHeight + 3
        );
        ctx.fillText(
          minValue,
          minX - scaleLineWidth,
          y + ((100 - minValue) / 100) * canvasHeight + 15
        );
      } else {
        ctx.moveTo(
          minX,
          y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2
        );
        ctx.lineTo(
          minX - scaleLineWidth,
          y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2
        );
        ctx.direction = 'rtl';
        ctx.fillText(
          pen.data.minText,
          minX - scaleLineWidth,
          y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3
        );
        ctx.fillText(
          minValue,
          minX - scaleLineWidth,
          y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15
        );
      }
    } else if (maxValue && !minValue) {
      if (width >= height) {
        ctx.moveTo(maxX, y + ((100 - maxValue) / 100) * canvasHeight);
        ctx.lineTo(
          maxX - scaleLineWidth,
          y + ((100 - maxValue) / 100) * canvasHeight
        );
        ctx.direction = 'rtl';
        ctx.fillText(
          pen.data.maxText,
          maxX - scaleLineWidth,
          y + ((100 - maxValue) / 100) * canvasHeight + 3
        );
        ctx.fillText(
          maxValue,
          maxX - scaleLineWidth,
          y + ((100 - maxValue) / 100) * canvasHeight + 15
        );
      } else {
        ctx.moveTo(
          maxX,
          y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2
        );
        ctx.lineTo(
          maxX - scaleLineWidth,
          y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2
        );
        ctx.direction = 'rtl';
        ctx.fillText(
          pen.data.maxText,
          maxX - scaleLineWidth,
          y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3
        );
        ctx.fillText(
          maxValue,
          maxX - scaleLineWidth,
          y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15
        );
      }
    }
    ctx.stroke();
  ctx.closePath();
  }