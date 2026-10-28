import { InputMode, Pen, TextDecoration, TextVertical, TextWrap, TextAlign } from '@meta2d/core';

const domShapes = ['gif', 'iframe', 'video', 'echarts', 'highcharts', 'lightningCharts', 'vue'];

const del = ['scrolling', 'blur', 'blurBackground'];

const sameList = [
  'parentId',
  'id',
  'tags',
  'visible',
  'color',
  'background',
  'backgroundImage',
  'ratio',
  'scrolling',
  'scale',
  'flipX',
  'flipY',
  'fillTexts',
  'hoverColor',
  'hoverBackground',
  'activeColor',
  'activeBackground',
  'blur',
  'blurBackground',
  'lineWidth',
  'lineDash',
  'lineDashOffset',
  'lineCap',
  'lineJoin',
  'lineSmooth',
  'close',
  'length',
  'fromArrow',
  'toArrow',
  'fromArrowSize',
  'toArrowSize',
  'fromArrowColor',
  'toArrowColor',
  'autoFrom',
  'autoTo',
  'fromLineCap',
  'toLineCap',
  'borderWidth',
  'borderColor',
  // 'borderRadius',
  'shadowColor',
  'shadowBlur',
  'shadowOffsetX',
  'shadowOffsetY',
  'text',
  'fontFamily',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'fontStyle',
  'fontWeight',
  'textWidth',
  'textHeight',
  'textTop',
  'textLeft',
  'textColor',
  'textAlign',
  'textBackground',
  'textFlip',
  'textRotate',
  'ellipsis',
  'keepDecimal',
  'textDecorationDash',
  'textDecorationColor',
  'disabled',
  'disabledColor',
  'disabledBackground',
  'disabledTextColor',
  'image',
  'imageRatio',
  'imageRadius',
  'crossOrigin',
  'icon',
  'iconTop',
  'iconLeft',
  'iconWidth',
  'iconHeight',
  'iconRotate',
  'iconColor',
  'iconFamily',
  'iconWeight',
  'iconSize',
  'iconAlign',
  'pathId',
  'iframe',
  'video',
  'audio',
  'currentAnimation',
  'autoPlay',
  'playLoop',
  'progress',
  'verticalProgress',
  'reverseProgress',
  'children',
  'showChild',
  'isBottom',
  'zIndex',
  'className',
  'styles',
  'operationalRect',
];

const unProcessedList = [
  'lineIsEdge',
  'interactive',
  'backgrounds',
  'gradient',
  'lineGradient',
  'lineType',
  'lineImage',
  'pathFill',
  'attributes',
  'segment',
  'position',
];

const converTwoWay = (twoWay: number) => {
  switch (twoWay) {
    case 3:
      return 2;
    case 4:
      return 1;
    case 10:
      return 3;
    default:
      return twoWay;
  }
};

const converRules = [
  {
    target: 'category',
    source: 'type',
    transform: (pen: any) => {
      if (domShapes.includes(pen.name) || pen.externElement || pen.name?.endsWith('Dom')) {
        delete pen.type;
        delete pen.externElement;
        if (pen.name === 'gif') {
          return undefined;
        }
        return 2;
      }
      return pen.type || 0;
    },
  },
  {
    target: 'name',
    source: 'description',
  },
  {
    target: 'type',
    source: 'name',
    transform: (pen: any) => {
      if (pen.name === 'combine') {
        return 'group';
      }
      if (pen.name === 'line') {
        if (pen.lineName === 'polyline') {
          return 'orthogonal';
        }
        return pen.lineName;
      }
      if (pen.name === 'table2' || pen.name === 'table') {
        pen.name = 'tablePlus';
      }
      return pen.name;
    },
  },
  {
    target: 'bkType',
    source: 'bkType',
    transform: (pen: any) => {
      if (pen.backgroundImage) {
        return 3;
      }
      return pen.bkType;
    },
  },
  {
    target: 'opacity',
    source: 'globalAlpha',
  },
  {
    target: 'tooltip',
    source: 'title',
  },
  {
    target: 'tooltipJs',
    source: 'titleFnJs',
  },
  {
    target: 'borderRadius',
    source: 'borderRadius',
    transform: (pen: any) => {
      if (0 < pen.borderRadius && pen.borderRadius < 1) {
        return pen.borderRadius * Math.min(pen.width, pen.height);
      } else {
        return pen.borderRadius;
      }
    },
  },
  {
    target: 'anchors',
    source: 'anchors',
    transform: (pen: any) => {
      return pen.anchors.map((item: any) => {
        const rect = {
          x: pen.x,
          y: pen.y,
          width: pen.width,
          height: pen.height,
        };
        return {
          id: item.id,
          x: rect.x + item.x * rect.width,
          y: rect.y + item.y * rect.height,
          radius: item.radius,
          background: item.background,
          visible: !item.hidden,
          disabled: item.locked > 1,
          title: item.title,
          connectedPen: item.connectTo,
          connectedAnchor: item.anchorId,
          twoWay: converTwoWay(item.twoWay),
          cp2: item.prev
            ? {
                ...item.prev,
                x: rect.x + item.prev.x * rect.width,
                y: rect.y + item.prev.y * rect.height,
              }
            : undefined,
          cp1: item.next
            ? {
                ...item.next,
                x: rect.x + item.next.x * rect.width,
                y: rect.y + item.next.y * rect.height,
              }
            : undefined,
          handleType: item.prevNextType,
          length: item.lineLength,
          temp: item.isTemp,
          direction: item.direction,
          host: item.penId,
        };
      });
    },
  },
  {
    target: 'textVisible',
    source: 'hiddenText',
    transform: (pen: any) => {
      return !pen.hiddenText;
    },
  },
  {
    target: 'lineSmooth',
    source: 'lineSmooth',
    transform: (pen: any) => {
      // gradientSmooth 或 lineSmooth 谁有值(不为0)就使用谁
      if (pen.gradientSmooth) {
        return pen.gradientSmooth;
      }
      return pen.lineSmooth;
    },
  },
  {
    target: 'lineSmooth',
    source: 'gradientSmooth',
    transform: (pen: any) => {
      // gradientSmooth 或 lineSmooth 谁有值(不为0)就使用谁
      if (pen.gradientSmooth) {
        return pen.gradientSmooth;
      }
      return pen.lineSmooth;
    },
  },
  { target: 'textShadow', source: 'textHasShadow' },
  {
    target: 'textVertical',
    source: 'textBaseline',
    transform: (pen: any) => {
      switch (pen.textBaseline) {
        case 'top':
          return TextVertical.Top;
        case 'middle':
          return TextVertical.Middle;
        case 'bottom':
          return TextVertical.Bottom;
        default:
          return TextVertical.Middle;
      }
    },
  },
  {
    target: 'textAlign',
    source: 'textAlign',
    transform: (pen: any) => {
      switch (pen.textAlign) {
        case 'left':
          return TextAlign.Left;
        case 'center':
          return TextAlign.Center;
        case 'right':
          return TextAlign.Right;
        default:
          return TextAlign.Center;
      }
    },
  },
  {
    target: 'textGradient',
    source: 'textGradientColors',
    transform: () => {},
  },
  { target: 'textHoverColor', source: 'hoverTextColor' },
  { target: 'textActiveColor', source: 'activeTextColor' },
  {
    target: 'textWrap',
    source: 'whiteSpace',
    transform: (pen: any) => {
      switch (pen.whiteSpace) {
        case 'pre-line':
          return TextWrap.Line;
        case 'nowrap':
          return TextWrap.Nowrap;
        default:
          return TextWrap.Normal;
      }
    },
  },
  {
    target: 'textDecoration',
    source: 'textDecoration',
    transform: (pen: any) => {
      if (pen.textDecoration) {
        return TextDecoration.Underline;
      }
    },
  },
  {
    target: 'textDecoration',
    source: 'textStrickout',
    convert: (newPen: any, pen: any) => {
      if (pen.textStrickout) {
        newPen.textDecorationDash = pen.textStrickoutDash;
        newPen.textDecorationColor = pen.textStrickoutColor;
        newPen.textDecoration = TextDecoration.LineThrough;
        delete pen.textStrickoutColor;
        delete pen.textStrickoutDash;
      }
    },
  },
  { target: 'textAutoSize', source: 'textAutoAdjust' },
  {
    target: 'input',
    source: 'input',
    transform: (pen: any) => {
      if (pen.input) {
        if (pen.type === 'number') {
          return InputMode.Number;
        } else {
          return InputMode.Text;
        }
      }
    },
  },
  {
    target: 'form',
    source: 'form',
    convert: (newPen: any, pen: any) => {
      if (pen.formId) {
        const mapping = {
          formId: 'id',
          formName: 'name',
          formType: 'type',
          formData: 'data',
          formKey: 'key',
          formValue: 'value',
        };
        newPen.form = {};
        Object.entries(mapping).forEach(([oldKey, newKey]) => {
          if (oldKey in pen) {
            newPen.form[newKey] = pen[oldKey];
            delete pen[oldKey];
          }
        });
      }
    },
  },
  {
    target: 'properties',
    source: 'form',
    transform: (pen: any) => {
      return (
        pen.form?.map((item: any) => ({
          label: item.name,
          key: item.key,
          type: item.type,
          ...(item.dataId && { bind: { label: item.dataId.name, id: item.dataId.dataId } }),
        })) ?? []
      );
    },
  },
  {
    target: 'properties',
    source: 'realTimes',
  },
  {
    target: 'connectedLines',
    source: 'connectedLines',
    convert: (newPen: any, pen: any) => {
      newPen.connectedLines = pen.connectedLines.map((item: any) => {
        return {
          penId: item.lineId,
          penAnchor: item.lineAnchor,
          anchor: item.anchor,
        };
      });
    },
  },
  {
    target: 'progressMin',
    source: 'min',
    convert: (newPen: any, pen: any) => {
      if (pen.progress !== undefined) {
        newPen.progressMin = pen.min;
      } else {
        newPen.min = pen.min;
      }
    },
  },
  {
    target: 'progressMax',
    source: 'max',
    convert: (newPen: any, pen: any) => {
      if (pen.progress !== undefined) {
        newPen.progressMax = pen.max;
      } else {
        newPen.max = pen.max;
      }
    },
  },
  {
    target: 'zIndex',
    source: 'zIndex',
    convert: (newPen: Pen, pen: any) => {
      newPen.zIndex = pen.zIndex;
      if (pen.zIndex < 4) {
        newPen.isBottom = true;
      } else {
        newPen.isBottom = undefined;
      }
      delete pen.zIndex;
    },
  },
  {
    target: 'shadowBlur',
    source: 'shadowBlur',
    transform: (pen: any) => {
      // shadowBlur 值过大会造成性能问题，超过 15 时重置为 0
      if (pen.shadowBlur > 15) {
        return 0;
      }
      return pen.shadowBlur;
    },
  },
];

export function applyPenRules(newPen: any, pen: any) {
  for (const rule of converRules) {
    if (rule.source in pen || ['type'].includes(rule.source)) {
      if (rule.transform) {
        newPen[rule.target] = rule.transform(pen);
      } else if (rule.convert) {
        rule.convert(newPen, pen);
      } else {
        newPen[rule.target] = pen[rule.source];
      }
      delete pen[rule.source];
    }
  }
}
