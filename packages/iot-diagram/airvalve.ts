export function airvalve(pen: any) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  let myw = pen.calculative.worldRect.width / 6;
  let myh = pen.calculative.worldRect.height / 6.5;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;

  path.moveTo(x, y + myh);
  path.lineTo(x, y + pen.calculative.worldRect.height);
  path.lineTo(x + myw, y + pen.calculative.worldRect.height - myh);
  path.lineTo(x + myw, y);
  path.lineTo(x, y + myh);

  path.moveTo(x, y + myh * 6.5);
  path.lineTo(x + myw * 5, y + myh * 6.5);
  path.lineTo(x + myw * 6, y + myh * 5.5);
  path.lineTo(x + myw, y + myh * 5.5);
  path.lineTo(x, y + myh * 6.5);

  let isOpen = pen.data.isOpen;
  if (isOpen) {
    for (let i = 0; i < 3; i++) {
      path.rect(x + myw, y + myh * (1 + i) + (myh / 2) * i, myw * 4, myh / 2);
      path.moveTo(x, y + myh * (i + 2) + (myh / 2) * (i + 1));
      path.lineTo(x + myw * 5, y + myh * (i + 2) + (myh / 2) * (i + 1));
      path.lineTo(x + myw * 6, y + myh * (i + 1) + (myh / 2) * (i + 1));
      path.lineTo(x + myw, y + myh * (i + 1) + (myh / 2) * (i + 1));
      path.lineTo(x, y + myh * (i + 2) + (myh / 2) * (i + 1));
    }
  } else {
    for (let i = 0; i < 3; i++) {
      path.moveTo(x + myw / 2, y + myh / 2 + ((myh * 5.5) / 3) * i);
      path.rect(
        x + myw / 2,
        y + myh / 2 + ((myh * 5.5) / 3) * i,
        myw * 5,
        (myh * 5.5) / 3
      );
    }
  }

  path.moveTo(x, y + myh);
  path.lineTo(x + myw * 5, y + myh);
  path.lineTo(x + myw * 6, y);
  path.lineTo(x + myw, y);
  path.lineTo(x, y + myh);

  path.moveTo(x + myw * 5, y + myh);
  path.lineTo(x + myw * 5, y + pen.calculative.worldRect.height);
  path.lineTo(x + myw * 6, y + pen.calculative.worldRect.height - myh);
  path.lineTo(x + myw * 6, y);
  path.lineTo(x + myw * 5, y + myh);
  path.closePath();

  return path;
}
