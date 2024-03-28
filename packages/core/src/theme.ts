export interface Theme {
  [key: string]: {
    color?: string;
    background?: string;
    parentBackground?: string;
    ruleColor?:string;
    ruleOptions?:{
      background?:string,
      textColor?:string
    }
  };
}

export const defaultTheme: Theme = {
  dark:{
    color:'#bdc7db',
    background:'#1e2430',
    parentBackground:'#080b0f',
    ruleColor:'#222E47',
    ruleOptions:{
      background:'#121924',
      textColor:'#6E7B91'
    },
  },
  light:{
    color:'#222222',
    background:'#FFFFFF',
    parentBackground:'#F0F1F2',
    ruleColor:'#C8D0E1',
    ruleOptions:{
      background:'#F7F8FA',
      textColor:'#C8D0E1'
    },
  }
}