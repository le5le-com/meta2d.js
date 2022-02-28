export function getTextLength(text: string, pen: any) {
  const textScale = (pen.calculative.worldRect.height * 14) / 16;
  const chinese = text.match(/[\u4e00-\u9fa5]/g) || '';
  const chineseLen = chinese.length;
  const width =
    (text.length - chineseLen) * textScale * 0.6 + chineseLen * textScale;
  return width;
}

export function initOptions(pen: any) {
  if (pen.direction == 'horizontal') {
    const optionPos = [];
    let textLength = 0;
    const h = pen.height;
    pen.checkboxHeight = h;
    pen.options.forEach((item: any, index: number) => {
      optionPos.push(index * (40 + h) + textLength);
      textLength += getTextLength(item.text, pen);
    });
    pen.optionPos = optionPos;
    const width = optionPos.length * (40 + h) + textLength;
    pen.checkboxWidth = width;
    pen.width = width;
    pen.calculative.width = width;
    pen.calculative.worldRect = {
      x: pen.x,
      y: pen.y,
      ex: pen.x + pen.width,
      ey: pen.y + pen.height,
      height: pen.height,
      width: pen.width,
    };
  } else if (pen.direction == 'vertical') {
    if (!pen.optionInterval) {
      pen.optionInterval = 20;
    }
    if (!pen.optionHeight) {
      pen.optionHeight = 20;
    }
    const optionPos = [];
    pen.options.forEach((item: any, index: number) => {
      optionPos.push(index * (pen.optionInterval + pen.optionHeight));
    });
    pen.optionPos = optionPos;
    const height = optionPos[optionPos.length - 1] + pen.optionHeight;
    pen.checkboxHeight = height;
    if (!pen.width) {
      pen.height = height;
      pen.calculative.height = height;
      pen.calculative.worldRect = {
        x: pen.x,
        y: pen.y,
        ex: pen.x + pen.width,
        ey: pen.y + pen.height,
        height: pen.height,
        width: pen.width,
      };
    }
  }
}
