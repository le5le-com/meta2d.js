import { AnchorMode, Options } from '../types';

/** 多人协作成员的默认调色板。调用方可通过 Options.collaborateColors 覆盖。 */
export const defaultCollaborateColors = [
  '#E34D59',
  '#ED7B2F',
  '#F5BE18',
  '#00A870',
  '#43D3F0',
  '#4583FF',
  '#A470FE',
  '#E65AB7',
];

/** 协作补丁允许同步的页面配置字段。 */
export const collaboratePageKeys = [
  'width',
  'height',
  'background',
  'backgroundGradient',
  'backgroundImage',
  'color',
  'lineGradient',
  'penBackground',
  'penGradient',
  'theme',
  'disableTranslate',
  'disableScale',
  'lineIntersect',
  'initJs',
  'messageNormalizer',
  'vars',
] as const;

export const defaultOptions: Options = {
  anchorMode: AnchorMode.Hidden,
  fontFamily: '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial',
  hoverBoxColor: '#1890ffa0',
  activeBoxColor: '#1890ff',
  anchorColor: '#fa541c',
  hoverAnchorColor: '#FF4101',
  color: '#222222',
  activeColor: '#278df8',
  hoverColor: 'rgba(39,141,248,0.8)',
  anchorRadius: 4,
  anchorBackground: '#fff',
  dockColor: '#00a00020',
  dragSelectionColor: '#1890ff',
  hoverCursor: 'pointer',
  minScale: 0.1,
  maxScale: 10,
  animateInterval: 20,
  lineTextBackground: '#ffffff',
  // 最小发送间隔（见 Options.patchQueueDelay）。实测（1 万 / 4000 / 1000 / 100 个图元，10~30ms 刷新）：
  // 间隔从 0 调到 100 帧率都不变；图元多时延迟由画一批的耗时决定，间隔无影响；图元少时间隔直接叠进延迟
  // （100 个图元：0 → 10ms，16 → 15ms，100 → 55ms）。16 ≈ 一帧：延迟几乎不损失，又把批次上限压在帧率附近。
  patchQueueDelay: 16,
  collaborateColors: defaultCollaborateColors,
};
