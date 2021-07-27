export function pool(pen: any) {
  if (!pen.calculative || !pen.calculative.worldRect) {
     return;
  }
  const path = new Path2D();
 
//   const scale =1; //window.topology?.data?.scale ?? 1; // 若不存在设置默认值1

  const borderWidth =2; //node.data.style.borderWidth * scale;
  // 画水池边框三个灰色的矩形
  path.rect(pen.calculative.worldRect.x, pen.calculative.worldRect.y, borderWidth, pen.calculative.worldRect.height); // 左边矩形
  // 右侧矩形
  path.rect(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width - borderWidth,
    pen.calculative.worldRect.y,
    borderWidth,
    pen.calculative.worldRect.height
  );
  // 下边矩形
  path.rect(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height - borderWidth,
    pen.calculative.worldRect.width,
    borderWidth
  );


  // 水池中间，蓝色水池
  let value = pen.data.value;
  path.rect(
    pen.calculative.worldRect.x + borderWidth,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height - borderWidth,
    pen.calculative.worldRect.width - borderWidth * 2,
    -value * (pen.calculative.worldRect.height - borderWidth)
  );
  
  path.closePath();
  return path;
}