export interface Theme {
  [key: string]: {
    color?: string;
    background?: string;
    parentBackground?: string;
    ruleColor?: string;
    ruleOptions?: {
      background?: string,
      textColor?: string
    }
  };
}

export const themeKeys = [
  'color',
  'hoverColor',
  'activeColor',
  'disabledColor',
  'background',
  'activeBackground', //有无必要
  'hoverBackground',
  'disabledBackground',
  'anchorColor',
  'hoverAnchorColor',
  'anchorBackground',
  'animateColor',
  'textColor',
  'ruleColor',
  'ruleLineColor',
  'gridColor',
  'lineColor',
// "ruleOptions"
] 

export const defaultTheme: Theme = {
  dark: {
    color: '#bdc7db',
    background: '#1e2430',
    parentBackground: '#080b0f',
    ruleColor: '#222E47',
    ruleOptions: {
      background: '#121924',
      textColor: '#6E7B91'
    },
  },
  light: {
    color: '#222222',
    background: '#FFFFFF',
    parentBackground: '#F0F1F2',
    ruleColor: '#C8D0E1',
    ruleOptions: {
      background: '#F7F8FA',
      textColor: '#C8D0E1'
    },
  }
}
// le5le主题对象
export const le5leTheme = {
  "cssRuleSelector": ":root",
  "style_prefix": "le5le_",
  "vendor_css_prefix": "--le-",
  "dark": [
    'text-color-primary: #7f838c',
    'text-color-second: rgba(255,255,255,0.90)',
    'text-color-disabled: rgba(255,255,255,0.40)',

    'container-bg: rgba(21,24,28,0.95)',
    'form-bg: #2a2f36',
    'date-picker-cell-active-with-range-bg: #2c4475',
    'component-disabled-bg-color: #252b37',
    'data-picker-cell-active-bg: #4583ff',
    'active-bg: #25375b',
    'popcontent-bg: #252b37',

    'bdcolor-outside: #4583ff',
    'bdcolor-form: #424b61',
    'bdcolor-inside: rgba(255,255,255,0.40)',

    'shadow: 0px 1px 10px 0px rgba(0,0,0,0.05), 0px 4px 5px 0px rgba(0,0,0,0.08), 0px 2px 4px -1px rgba(0,0,0,0.12)',
    'radius: 4px',
  ],
  "light": [
    'text-color-primary: #7f838c',
    'text-color-second: #171B27',
    'text-color-disabled: rgba(0, 0, 0, 0.6)',

    'container-bg: #ffffff',
    'form-bg: #EFF1F4',
    'date-picker-cell-active-with-range-bg: #f2f3ff',
    'component-disabled-bg-color: #eee',
    'data-picker-cell-active-bg: #0052d9',
    'active-bg: #f2f3ff',
    'popcontent-bg: #ffffff',

    'bdcolor-outside: transparent',
    'bdcolor-form: #d4d6d9',
    'bdcolor-inside: #e7e7e7',

    'shadow: 0px 2px 4px 0px rgba(107,113,121,0.25)',
    'radius: 4px',
  ],
  /**
   * @description 添加厂商前缀，如：--le-text-color-primary: #7f838c
   * @author Joseph Ho
   * @date 26/12/2024
   * @param {*} theme
   * @returns {*}  
   */
  _addVendorCssPrefix(themeList) {
    return themeList.map(item =>{
      const [key, value] = item.split(':');
      return `${this.vendor_css_prefix}${key.trim()}:${value.trim()}`;
    })
  },
  /**
   * @description 创建主题css变量样式表
   * @author Joseph Ho
   * @date 26/12/2024
   * @param {*} theme 主题名
   * @param {*} id 样式表id，用于查找样式表，确保唯一
   */
  createThemeSheet(theme,id) {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.id = this.style_prefix + id;
    document.head.appendChild(style);
    // 设置初始样式变量
    const _theme = theme || 'light';
    const cssDeclarations = this.getTheme(_theme);
    const newRuleText = `${this.cssRuleSelector} { ${cssDeclarations.join(';')} }`;
    style.innerHTML = newRuleText;
  },
  /**
   * @description 销毁主题样式表，根据id查找样式表并删除，释放内存空间，避免内存泄漏
   * @author Joseph Ho
   * @date 26/12/2024
   * @param {*} id
   */
  destroyThemeSheet(id) {
    const styleSheet = this.findStyleSheet(this.style_prefix + id);
    if (styleSheet) {
      document.head.removeChild(styleSheet.ownerNode);
    }
  },
  /**
   * @description 根据主题名称获取主题变量
   * @author Joseph Ho
   * @date 26/12/2024
   * @param {*} theme
   * @returns {*}  
   */
  getTheme(theme) {
    return this._addVendorCssPrefix(this[theme] || this.light);
  },
  /**
   * @description 根据id查找样式表
   * @author Joseph Ho
   * @date 26/12/2024
   * @param {*} id
   * @returns {*}  
   */
  findStyleSheet(id) {
    const styleSheets = document.styleSheets;
    for (let i = 0; i < styleSheets.length; i++) {
      const styleSheet = styleSheets[i];
      if (styleSheet.ownerNode && (styleSheet.ownerNode as any).id === id) {
        return styleSheet;
      }
    }
    return null;
  },
  /**
   * @description 更新样式表的主题变量
   * @author Joseph Ho
   * @date 26/12/2024
   * @param {*} id
   * @param {*} theme
   */
  updateCssRule(id, themeName) {
    const theme = this.getTheme(themeName)
    const newCssDeclarations = theme;
    const styleSheet = this.findStyleSheet(this.style_prefix + id);
    let ruleExists = false;
    for (let i = 0; i < styleSheet.cssRules.length; i++) {
      const rule = styleSheet.cssRules[i];
      if (rule.selectorText === this.cssRuleSelector) {
        ruleExists = true;
        break;
      }
    }
    if (ruleExists) {
      // 先删除旧规则，再插入新规则
      for (let i = 0; i < styleSheet.cssRules.length; i++) {
        const rule = styleSheet.cssRules[i];
        if (rule.selectorText === this.cssRuleSelector) {
          if (styleSheet.insertRule) {
            styleSheet.deleteRule(i);
            const newRuleText = `${this.cssRuleSelector} { ${newCssDeclarations.join(';')} }`;
            styleSheet.insertRule(newRuleText, i);
          } else if (styleSheet.addRule) {
            rule.style.cssText = newCssDeclarations.join(';');
          }
        }
      }
    } else {
      // 插入新规则
      if (styleSheet.insertRule) {
        const newRuleText = `${this.cssRuleSelector} { ${newCssDeclarations.join(';')} }`;
        styleSheet.insertRule(newRuleText, styleSheet.cssRules.length);
      } else if (styleSheet.addRule) {
        const existingRootRule = styleSheet.cssRules.find(rule => rule.selectorText === this.cssRuleSelector);
        if (existingRootRule) {
          const declarationsToAdd = newCssDeclarations.join(';');
          existingRootRule.style.cssText += `; ${declarationsToAdd}`;
        } else {
          styleSheet.addRule(this.cssRuleSelector, newCssDeclarations.join(';'));
        }
      }
    }
  }
}