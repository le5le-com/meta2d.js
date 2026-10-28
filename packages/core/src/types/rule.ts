export enum RuleStyle {
  Simple,
  Strip,
}

// 添加配置对象与RuleStyle关联
export interface RuleConfig {
  ruleSize: number;
  minorStartPos: number;
  minorEndPos: number;
  textTop: number;
}
