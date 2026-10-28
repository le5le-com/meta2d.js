export const presetPalettes: string[] = [
  '#FF5959',
  '#F5693B',
  '#E6B420',
  '#30EE6F',
  '#30EEDC',
  '#31A7F5',
  '#7381FF',
  '#AB73FF',
  '#F054B1',
  '#F75781',
  '#ff925c',
  '#e6d950',
  '#51e69b',
  '#59c8ff',
  '#FF7875',
  '#FF9C6E',
  '#FFC069',
  '#FFD666',
  '#FFF566',
  '#D3F261',
  '#95DE64',
  '#5CDBD3',
  '#69C0FF',
  '#85A5FF',
  '#B37FEB',
  '#FF85C0',
  '#000000',
  '#FFFFFF',
  '#FFFFFF00',
];
export const fonts = [
  '新宋体',
  '微软雅黑',
  '黑体',
  '楷体',
  '斗鱼追光体',
  '庞门正道标题体',
  'DS-DIGI-1',
  'DS-DIGIB-2',
  'DS-DIGII-3',
  'DS-DIGIT-4',
  'ALIBABA Regular',
  'ALIBABA Bold',
  '-apple-system',
  'BlinkMacSystemFont',
  'PingFang SC',
  'Hiragino Sans GB',
  'Microsoft YaHei UI',
  'Microsoft YaHei',
  'fangsong',
  'Source Han Sans CN',
  'sans-serif',
  'serif',
  'Apple Color Emoji',
  'Segoe UI Emoji',
  'Segoe UI Symbol',
];

export declare enum LockState {
  None = 0,
  DisableEdit = 1,
  DisableMove = 2,
  DisableScale = 3, //仅占位
  DisableMoveScale = 4,
  Disable = 10,
}
export const defalutStyles = [
  {
    icon: 'black-solid',
    value: {
      background: '#000000',
    },
  },
  {
    icon: 'black-outline',
    value: {
      borderColor: '#000000',
    },
  },
  {
    icon: 'black-solid-outline',
    value: {
      background: '#DCDDE1',
      borderColor: '#000000',
    },
  },
  {
    icon: 'red-solid',
    value: {
      background: '#F6685D',
    },
  },
  {
    icon: 'red-outline',
    value: {
      borderColor: '#F6685D',
    },
  },
  {
    icon: 'red-solid-outline',
    value: {
      background: '#FFD8D2',
      borderColor: '#F6685D',
    },
  },
  {
    icon: 'orange-solid',
    value: {
      background: '#E37318',
    },
  },
  {
    icon: 'orange-outline',
    value: {
      borderColor: '#E37318',
    },
  },
  {
    icon: 'orange-solid-outline',
    value: {
      background: '#FFD9C2',
      borderColor: '#E37318',
    },
  },
  {
    icon: 'yellow-solid',
    value: {
      background: '#F5BA18',
    },
  },

  {
    icon: 'yellow-outline',
    value: {
      borderColor: '#F5BA18',
    },
  },
  {
    icon: 'yellow-solid-outline',
    value: {
      background: '#FFE7B5',
      borderColor: '#F5BA18',
    },
  },
  {
    icon: 'green-solid',
    value: {
      background: '#2BA471',
    },
  },
  {
    icon: 'green-outline',
    value: {
      borderColor: '#2BA471',
    },
  },
  {
    icon: 'green-solid-outline',
    value: {
      background: '#C6F3D7',
      borderColor: '#2BA471',
    },
  },
  {
    icon: 'cyan-solid',
    value: {
      background: '#02C3D4',
    },
  },
  {
    icon: 'cyan-outline',
    value: {
      borderColor: '#02C3D4',
    },
  },
  {
    icon: 'cyan-solid-outline',
    value: {
      background: '#C4FFFF',
      borderColor: '#02C3D4',
    },
  },
  {
    icon: 'blue-solid',
    value: {
      background: '#4583FF',
    },
  },
  {
    icon: 'blue-outline',
    value: {
      borderColor: '#4583FF',
    },
  },
  {
    icon: 'blue-solid-outline',
    value: {
      background: '#D9E8FF',
      borderColor: '#4583FF',
    },
  },
  {
    icon: 'purple-solid',
    value: {
      background: '#AD75FE',
    },
  },
  {
    icon: 'purple-outline',
    value: {
      borderColor: '#AD75FE',
    },
  },
  {
    icon: 'purple-solid-outline',
    value: {
      background: '#EEDCFF',
      borderColor: '#AD75FE',
    },
  },
  {
    icon: 'magenta-solid',
    value: {
      background: '#E851B3',
    },
  },
  {
    icon: 'magenta-outline',
    value: {
      borderColor: '#E851B3',
    },
  },
  {
    icon: 'magenta-solid-outline',
    value: {
      background: '#FFD8EB',
      borderColor: '#E851B3',
    },
  },
];
// 格式刷同步的属性
export const defaultFormatAttrs: Set<string> = new Set([
  'color',
  'hoverColor',
  'activeColor',
  'hoverBackground',
  'activeBackground',
  'lineWidth',
  'lineDash',
  'lineSmooth',
  'lineGradient',
  'backgrounds',
  'borderWidth',
  'borderColor',
  'borderRadius',
  'shadowColor',
  'shadowBlur',
  'shadowOffsetX',
  'shadowOffsetY',
  'flipX',
  'flipY',
  'progress',
  'progressMin',
  'progressMax',
  'verticalProgress',
  'reverseProgress',
  'progressColors',
  'fontFamily',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textVertical',
  'fontWeight',
  'fontStyle',
  'textColor',
  'textGradient',
  'textHoverColor',
  'textActiveColor',
  'textBackground',
  'textLeft',
  'textTop',
  'textWidth',
  'textHeight',
  'keepDecimal',
  'textWrap',
  'ellipsis',
]);
