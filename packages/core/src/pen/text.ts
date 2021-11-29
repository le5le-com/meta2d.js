import { Pen } from '.';

export function calcTextRect(pen: Pen) {
  const { paddingTop, paddingBottom, paddingLeft, paddingRight } = pen.calculative;
  let x = paddingLeft;
  let y = paddingTop;
  let width = pen.calculative.worldRect.width - paddingLeft - paddingRight;
  let height = pen.calculative.worldRect.height - paddingTop - paddingBottom;
  let textLeft = pen.calculative.textLeft;
  let textTop = pen.calculative.textTop;
  if (textLeft && Math.abs(textLeft) < 1) {
    textLeft = pen.calculative.worldRect.width * textLeft;
  }

  if (textTop && Math.abs(textTop) < 1) {
    textTop = pen.calculative.worldRect.height * textTop;
  }
  x += textLeft || 0;
  y += textTop || 0;
  width -= textLeft || 0;
  height -= textTop || 0;

  x = pen.calculative.worldRect.x + x;
  y = pen.calculative.worldRect.y + y;

  const rect = {
    x,
    y,
    width,
    height,
    ex: x + width,
    ey: y + height,
  };
  pen.calculative.worldTextRect = rect;

  calcTextLines(pen);

  // By default, the text is center aligned.
  const lineHeight = pen.calculative.fontSize * pen.calculative.lineHeight;
  const h = pen.calculative.textLines.length * lineHeight;
  let textWidth = pen.calculative.textWidth || pen.calculative.worldTextRect.width;
  textWidth < 1 && (textWidth = textWidth * pen.calculative.worldTextRect.width);
  x = rect.x + (pen.calculative.worldTextRect.width - textWidth) / 2;
  y = rect.y + (rect.height - h) / 2;
  switch (pen.textAlign) {
    case 'left':
      x = rect.x;
      break;
    case 'right':
      x = rect.x + pen.calculative.worldTextRect.width - textWidth;
      break;
  }
  switch (pen.textBaseline) {
    case 'top':
      y = rect.y;
      break;
    case 'bottom':
      y = rect.ey - h;
      break;
  }

  pen.calculative.textDrawRect = {
    x,
    y,
    width: textWidth,
    height: h,
    ex: x + textWidth,
    ey: y + h,
  };
}

export function calcTextLines(pen: Pen) {
  if (!pen.calculative.text) {
    pen.calculative.textLines = [];
    return;
  }
  let lines = [];
  switch (pen.whiteSpace) {
    case 'nowrap':
      lines.push(pen.calculative.text);
      break;
    case 'pre-line':
      if (pen.calculative.text.split) {
        lines = pen.calculative.text.split(/[\n]/g);
      } else {
        lines = pen.calculative.text.toString().split(/[\n]/g);
      }
      break;
    default:
      let paragraphs: string[];
      if (pen.calculative.text.split) {
        paragraphs = pen.calculative.text.split(/[\n]/g);
      } else {
        paragraphs = pen.calculative.text.toString().split(/[\n]/g);
      }
      let h = 0;
      paragraphs.forEach((item) => {
        if (h < 0) {
          return;
        }
        const items = wrapLines(getWords(item), pen);

        if (pen.ellipsis != false) {
          items.forEach((l) => {
            if (h < 0) {
              return;
            }
            h += pen.calculative.fontSize * pen.calculative.lineHeight;
            let textHeight = pen.calculative.textHeight || pen.calculative.worldTextRect.height;
            // 认为是百分比
            textHeight < 1 && (textHeight = textHeight * pen.calculative.worldTextRect.height);
            if (h > textHeight) {
              l.slice(0, -3);
              l += '...';
              h = -1;
            }
            lines.push(l);
          });
        } else {
          lines.push(...items);
        }
      });
      break;
  }

  pen.calculative.textLines = lines;
}

export function getWords(txt: string) {
  const words = [];
  let word = '';
  if (!txt) {
    txt = '';
  }
  for (let i = 0; i < txt.length; ++i) {
    const ch = txt.charCodeAt(i);
    if (ch < 33 || ch > 126) {
      if (word) {
        words.push(word);
        word = '';
      }
      words.push(txt[i]);
      continue;
    } else {
      word += txt[i];
    }
  }

  if (word) {
    words.push(word);
  }

  return words;
}

export function wrapLines(words: string[], pen: Pen) {
  const lines = [];
  let currentLine = words[0] || '';
  for (let i = 1; i < words.length; ++i) {
    const word = words[i] || '';
    const text = currentLine + word;
    const chinese = text.match(/[\u4e00-\u9fa5]/g) || '';
    const chineseLen = chinese.length;
    let textWidth = pen.calculative.textWidth || pen.calculative.worldTextRect.width;
    textWidth < 1 && (textWidth = textWidth * pen.calculative.worldTextRect.width);
    if (
      (text.length - chineseLen) * pen.calculative.fontSize * 0.6 + chineseLen * pen.calculative.fontSize <=
      textWidth
    ) {
      currentLine += word;
    } else {
      currentLine.length && lines.push(currentLine);
      currentLine = word;
    }
  }
  currentLine.length && lines.push(currentLine);
  return lines;
}
