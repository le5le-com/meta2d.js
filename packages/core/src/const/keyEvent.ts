import { Pen, PenCategory } from '../models';
export const KeyEventPen: { [key: string]: Partial<Pen> } = {
  't': {
    type: 'text',
    text: '文字',
    textAlign: 1,
    textVertical: 1,
    textAutoSize: true,
    width: 24,
    height: 18,
  },
  'r': {
    type: 'rectangle',
    width: 100,
    height: 60,
  },
  // 'o' 原来是「放一个圆」，现在改为进入正交连线模式（见 meta2d-keyevent 的 o）
  'l': {
    type: 'line',
    category: PenCategory.Line,
    width: 100,
    height: 0,
  },
};
