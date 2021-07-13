import { TopologyPen } from '.';


export function calcTextRect(pen: TopologyPen) {
  if (!pen.text) {
    return;
  }
  let x = pen.textLeft || 0;
  let y = pen.textTop || 0;
  let width = pen.textWidth || pen.width;
  let height = pen.textHeight || pen.height;

  if (pen.textLeft && Math.abs(x) < 1) {
    x = pen.width * pen.textLeft;
  }

  if (pen.textTop && Math.abs(y) < 1) {
    x = pen.height * pen.textTop;
  }

  if (Math.abs(width) < 1) {
    width = pen.width * pen.textWidth;
  }

  if (Math.abs(height) < 1) {
    height = pen.height * pen.textHeight;
  }

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
  const lineHeight = pen.fontSize * pen.lineHeight;
  const h = pen.calculative.textLines.length * lineHeight;
  x = rect.x;
  y = rect.y + (rect.height - h) / 2;
  switch (pen.textAlign) {
    case 'left':
      x = rect.x;
      break;
    case 'right':
      x = rect.x + rect.width;
      break;
  }
  switch (pen.textBaseline) {
    case 'top':
      y = rect.y + (lineHeight - pen.fontSize) / 2;
      break;
    case 'bottom':
      y = rect.ey - h;
      break;
  }

  pen.calculative.textDrawRect = {
    x,
    y,
    width,
    height: h,
    ex: x + width,
    ey: y + h
  };
}

export function calcTextLines(pen: TopologyPen) {
  if (!pen.fontSize) {
    pen.fontSize = 12;
  }
  if (!pen.lineHeight) {
    pen.lineHeight = 1.5;
  }
  let lines = [];
  switch (pen.whiteSpace) {
    case 'nowrap':
      lines.push(pen.text);
      break;
    case 'pre-line':
      lines = pen.text.split(/[\n]/g);
      break;
    default:
      const paragraphs = pen.text.split(/[\n]/g);
      let h = 0;
      paragraphs.forEach((item) => {
        if (h < 0) {
          return;
        }
        const items = wrapLines(getWords(item), pen);
        if (pen.ellipsis) {
          items.forEach((l) => {
            if (h < 0) {
              return;
            }
            h += pen.fontSize * pen.lineHeight;
            if (h > pen.calculative.worldTextRect.height) {
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

export function wrapLines(words: string[], pen: TopologyPen) {
  const lines = [];
  let currentLine = words[0] || '';
  for (let i = 1; i < words.length; ++i) {
    const word = words[i] || '';
    const text = currentLine + word;
    const chinese = text.match(/[\u4e00-\u9fa5]/g) || '';
    const chineseLen = chinese.length;
    if ((text.length - chineseLen) * pen.fontSize * 0.6 + chineseLen * pen.fontSize < pen.calculative.worldTextRect.width) {
      currentLine += word;
    } else {
      currentLine.length && lines.push(currentLine);
      currentLine = word;
    }
  }
  currentLine.length && lines.push(currentLine);
  return lines;
}
