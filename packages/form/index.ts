import { defaultAnchorFn } from './src/anchors';
import { checkboxDefine } from './src/checkbox';
import { radioDefine } from './src/radio';
import { sliderDefine } from './src/slider';
import { switchDefine } from './src/switch';
import { timeDefine } from './src/time';

export const penDefines = [
  { ...radioDefine, defaultAnchorFn },
  { ...switchDefine, defaultAnchorFn },
  { ...checkboxDefine, defaultAnchorFn },
  { ...sliderDefine, defaultAnchorFn },
  { ...timeDefine, defaultAnchorFn },
];
