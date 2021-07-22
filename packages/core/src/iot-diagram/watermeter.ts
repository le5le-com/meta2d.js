import { TopologyPen } from '../pen';
export function watermeter(pen: any) {
  if (!pen.calculative || !pen.calculative.worldRect) {
     return;
  }
  const path = new Path2D();
 
  drawScale(path, pen);
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
  // 绘制水位线
  function drawScale(path: Path2D, pen: any) {
    const x = pen.calculative.worldRect.x;
    const y = pen.calculative.worldRect.y;
    const width = pen.calculative.worldRect.width;
    const height = pen.calculative.worldRect.height;
    const lR = width > height ? width : height;
    const R = width > height ? height : width;
    const r = Math.floor(R / 2);
    const scaleLineWidth = 7;//刻度每一个字符线宽
    const canvasHeight = R;
    const maxValue = pen.data.max;//pen.data.max;
    const minValue = pen.data.min;
    let minY, minl, minX;
    let maxY, maxl, maxX;
    let deltaX = 0; // min和max的X坐标差
    if (minValue) {
      if (width > height) {
        minY = Math.abs((y + ((100 - minValue) / 100) * canvasHeight) - (y + canvasHeight / 2));
        minl = Math.sqrt(Math.pow(r, 2) - Math.pow(minY, 2));
        minX = r - minl + x + lR / 2 - R / 2;
      } else if (width < height) {
        minY = Math.abs((y + ((100 - minValue) / 100) * canvasHeight) - (y + canvasHeight / 2));
        minl = Math.sqrt(Math.pow(r, 2) - Math.pow(minY, 2));
        minX = r - minl + x;
      } else {
        minY = Math.abs((y + ((100 - minValue) / 100) * canvasHeight) - (y + canvasHeight / 2));
        minl = Math.sqrt(Math.pow(r, 2) - Math.pow(minY, 2));
        minX = r - minl + x;
      }
    }
    if (maxValue) {
      if (width > height) {
        maxY = Math.abs((y + ((100 - maxValue) / 100) * canvasHeight) - (y + canvasHeight / 2));
        maxl = Math.sqrt(Math.pow(r, 2) - Math.pow(maxY, 2));
        maxX = r - maxl + x + lR / 2 - R / 2;
      } else if (width < height) {
        maxY = Math.abs((y + ((100 - maxValue) / 100) * canvasHeight) - (y + canvasHeight / 2));
        maxl = Math.sqrt(Math.pow(r, 2) - Math.pow(maxY, 2));
        maxX = r - maxl + x;
      } else {
        maxY = Math.abs((y + ((100 - maxValue) / 100) * canvasHeight) - (y + canvasHeight / 2));
        maxl = Math.sqrt(Math.pow(r, 2) - Math.pow(maxY, 2));
        maxX = r - maxl + x;
      }
    }
  
    // path.beginPath();
    // path.fillStyle = '#000';
    // path.font = 'normal 12px Arial';
    // 最大值和最小值都存在
    if (minValue && maxValue) {
      if (minX > maxX) {
        deltaX = minX - maxX;
  
        if (width >= height) {
          path.moveTo(minX, y + ((100 - minValue) / 100) * canvasHeight);
          path.lineTo(minX - scaleLineWidth - deltaX, y + ((100 - minValue) / 100) * canvasHeight);
        //   path.direction = "rtl";
        //   path.fillText(pen.data.minText, minX - scaleLineWidth - deltaX, y + ((100 - minValue) / 100) * canvasHeight + 3);
        //   path.fillText(minValue, minX - scaleLineWidth - deltaX, y + ((100 - minValue) / 100) * canvasHeight + 15);
  
          path.moveTo(maxX, y + ((100 - maxValue) / 100) * canvasHeight);
          path.lineTo(maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight);
        //   path.direction = "rtl";
        //   path.fillText(pen.data.maxText, maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight + 3);
        //   path.fillText(maxValue, maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight + 15);
        } else {
          path.moveTo(minX, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2);
          path.lineTo(minX - scaleLineWidth - deltaX, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2);
        //   path.direction = "rtl";
        //   path.fillText(pen.data.minText, minX - scaleLineWidth - deltaX, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3);
        //   path.fillText(minValue, minX - scaleLineWidth - deltaX, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15);
  
          path.moveTo(maxX, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2);
          path.lineTo(maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2);
        //   path.direction = "rtl";
        //   path.fillText(pen.data.maxText, maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3);
        //   path.fillText(maxValue, maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15);
        }
  
      } else {
        deltaX = maxX - minX;
        if (width >= height) {
          path.moveTo(minX, y + ((100 - minValue) / 100) * canvasHeight);
          path.lineTo(minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight);
        //   path.direction = "rtl";
        //   path.fillText(pen.data.minText, minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight + 3);
        //   path.fillText(minValue, minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight + 15);
  
          path.moveTo(maxX, y + ((100 - maxValue) / 100) * canvasHeight);
          path.lineTo(maxX - scaleLineWidth - deltaX, y + ((100 - maxValue) / 100) * canvasHeight);
        //   path.direction = "rtl";
        //   path.fillText(pen.data.maxText, maxX - scaleLineWidth - deltaX, y + ((100 - maxValue) / 100) * canvasHeight + 3);
        //   path.fillText(maxValue, maxX - scaleLineWidth - deltaX, y + ((100 - maxValue) / 100) * canvasHeight + 15);
        } else {
          path.moveTo(minX, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2);
          path.lineTo(minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2);
        //   path.direction = "rtl";
        //   path.fillText(pen.data.minText, minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3);
        //   path.fillText(minValue, minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15);
  
          path.moveTo(maxX, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2);
          path.lineTo(maxX - scaleLineWidth - deltaX, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2);
        //   path.direction = "rtl";
        //   path.fillText(pen.data.maxText, maxX - scaleLineWidth - deltaX, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3);
        //   path.fillText(maxValue, maxX - scaleLineWidth - deltaX, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15);
        }
  
      }
    } else if (minValue && !maxValue) {
      if (width >= height) {
        path.moveTo(minX, y + ((100 - minValue) / 100) * canvasHeight);
        path.lineTo(minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight);
        // path.direction = "rtl";
        // path.fillText(pen.data.minText, minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight + 3);
        // path.fillText(minValue, minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight + 15);
      } else {
        path.moveTo(minX, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2);
        path.lineTo(minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2);
        // path.direction = "rtl";
        // path.fillText(pen.data.minText, minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3);
        // path.fillText(minValue, minX - scaleLineWidth, y + ((100 - minValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15);
      }
    } else if (maxValue && !minValue) {
      if (width >= height) {
        path.moveTo(maxX, y + ((100 - maxValue) / 100) * canvasHeight);
        path.lineTo(maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight);
        // path.direction = "rtl";
        // path.fillText(pen.data.maxText, maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight + 3);
        // path.fillText(maxValue, maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight + 15);
      } else {
        path.moveTo(maxX, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2);
        path.lineTo(maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2);
        // path.direction = "rtl";
        // path.fillText(pen.data.maxText, maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 3);
        // path.fillText(maxValue, maxX - scaleLineWidth, y + ((100 - maxValue) / 100) * canvasHeight + lR / 2 - R / 2 + 15);
      }
  
    }
    // path.stroke();
  }
  // 绘制波浪
  function drawSin(path: Path2D, pen: any) {
    const points = [];
    const width = pen.calculative.worldRect.width;
    const height = pen.calculative.worldRect.height;
    const lR = width > height ? width : height;
    const R = width > height ? height : width;
    let canvasWidth, canvasHeight;
    if (width >= height) {
      canvasWidth = lR;
      canvasHeight = R;
    } else {
      canvasWidth = R;
      canvasHeight = lR;
    }
  let value = pen.data.value;
    const startX = pen.calculative.worldRect.x;
    const startY = pen.calculative.worldRect.y;
    const waveWidth = 0.2; //波浪宽度,数越小越宽
    const waveHeight = 1; //波浪高度,数越大越高
    const xOffset = Math.floor(Math.random()*10); //水平位移
    const yOffset = (value / 100) * R; //垂直位移
    // if(width >= height){
    //   yOffset = (pen.value / 100) *R; //垂直位移
    // }else{
    //   yOffset = ((pen.value / 100) *R); //垂直位移
    // }
    const maxValue = 70;//pen.data.max;
    const minValue =20;// pen.data.min;
    // path.strokeStyle = pen.value > maxValue ? pen.data.maxColor : pen.value < minValue ? pen.data.minColor : pen.data.fillColor;
  
    // path.beginPath();
    path.moveTo(startX, (canvasHeight / 2) +  waveHeight * Math.sin((startX + startX) * waveWidth + xOffset) + startY + R / 2 - yOffset)
    for (let x = startX; x < startX + canvasWidth; x += 20 / canvasWidth) {
      const y = waveHeight * Math.sin((startX + x) * waveWidth + xOffset) + startY + R / 2 - yOffset;
 
      points.push([x, (canvasHeight / 2) + y]);
      path.lineTo(x, (canvasHeight / 2) + y);
    }
    if (width >= height) {
      path.lineTo(startX + canvasWidth, startY + canvasHeight);
      path.lineTo(startX, startY + canvasHeight);
      path.lineTo(points[0][0], points[0][1]);
    } else {
      path.lineTo(startX + canvasWidth, startY + lR / 2 + R);
      path.lineTo(startX, startY + lR / 2 + R);
      path.lineTo(points[0][0], points[0][1]);
    }
  
    // path.stroke();
    const radius = canvasWidth / 2;
    // const grd = path.createLinearGradient(radius, radius, radius, canvasHeight);
    // grd.addColorStop(0, pen.value > maxValue ? pen.data.maxColor : pen.value < minValue ? pen.data.minColor : pen.data.fillColor);
    // grd.addColorStop(1, pen.value > maxValue ? pen.data.maxColor : pen.value < minValue ? pen.data.minColor : pen.data.fillColor);
    // path.fillStyle = grd;
    // path.fill();
  }