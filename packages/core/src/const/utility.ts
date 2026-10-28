import { RuleConfig, RuleStyle } from '../types';

export const RuleTextCorlor = '#555'; // 标尺刻度文字颜色
export const RuleLineColor = '#aaa'; // 标尺刻度线颜色
export const GuideLineColor = '#f00'; // 辅助线颜色

export const RuleStyleConfigs: Record<RuleStyle, RuleConfig> = {
  [RuleStyle.Simple]: {
    ruleSize: 20,
    minorStartPos: 0,
    minorEndPos: 8,
    textTop: 10,
  },
  [RuleStyle.Strip]: {
    ruleSize: 22,
    minorStartPos: 14,
    minorEndPos: 21,
    textTop: 2,
  },
};

export const GridColor = '#e7e7e7'; // 网格颜色

export const MIN_SCALE_THRESHOLD = 0.3;

export interface RuleGapConfig {
  minorInterval: number;
  majorInterval: number;
}

export const RuleGapConfigs: Record<string, RuleGapConfig> = {
  normal: {
    minorInterval: 10,
    majorInterval: 100,
  },
  small: {
    minorInterval: 100,
    majorInterval: 500,
  },
};
