export interface Theme {
  [key: string]: {
    color?: string;
    background?: string;
    parentBackground?: string;
    ruleOptions?: { color?: string; background?: string; textColor?: string };
  };
}
