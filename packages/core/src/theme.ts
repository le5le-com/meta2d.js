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
  'penBackground',
  'dockPenColor',
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
    'textColor-9: rgba(255,255,255,0.90)',
    'textColor-6: rgba(255,255,255,0.60)',
    'textColor-1: rgba(255,255,255,1)',
    'textColor-4: rgba(255,255,255,0.40)',
    'textPrimaryColor: #7f838c',
    'textSecondColor: rgba(255,255,255,0.90)',
    'textDisabledColor: rgba(255,255,255,0.40)',
    'textActiveColor: #0052d9',

    'buttonBg: #4583ff',
    'buttonDisabledBg: #0057CC',
    'buttonDisabledColor: #FFFFFF26',
    'buttonGradient: linear-gradient(360deg,#4583ff, #33ccff)',

    'containerBg: rgba(21,24,28,0.95)',
    'tabBg: #303746',
    'tabActiveBg: #4583ff',
    'tabDisabledBg: #282e3b',
    'tabDisabledColor: rgba(255,255,255,0.26)',
    'tabActiveColor: rgba(255,255,255,0.90)',
    'formBg: #2a2f36',
    'datePickerCellActiveRangeBg: #2c4475',
    'componentDisabledBg: #282e3b',
    'dataPickerCellActiveBg: #001b52',
    'activeBg: #25375b',
    'popContentBg: #252b37',
    'disabledBg: #7f838c',
    'disabledBg-2: #282E3B',

    'tableStripeColor: rgba(150,192,255,0.10)', //表格斑马纹颜色
    'tableMenuBg: #303746', //表格上方菜单的背景色
    'tableMenuDividerBg: rgb(76 81 94)', //表格上方菜单的分割线的背景色
    'tableMenuHandleBg: #454f64', //表格上方菜单手柄的背景色
    'tableMenuColor: #bdc7db', //表格上方菜单的颜色
    'tableMenuBorderColor: transparent', //表格上方菜单的颜色
    'tableColRowBg: #303746', //表格上方菜单的颜色
    'tableColRowActiveBg: #4A5263', //表格上方菜单的active颜色
    'tableColRowColor: rgba(255,255,255,0.6)', //表格col和row的背景色

    'paginationColor: rgba(255,255,255,0.6)', //分页器的颜色
    'paginationActiveColor: #4583ff', //分页器的颜色
    'paginationActiveBg: rgba(69,131,255,0.20)', //分页器的active颜色

    'sliderBg: #303746', //分页器的active颜色
    'sliderBtnBg: #000000', //分页器的active颜色

    'notificationBorderColor: transparent', //分页器的active颜色
    'notificationBg: #282e3b', //分页器的active颜色

    'borderColor: #424b61',
    'borderOutsideColor: #4583ff',
    'formBorderColor: #424b61',
    'borderInsideColor: rgba(255,255,255,0.40)',

    'shadow: 0px 1px 10px 0px rgba(0,0,0,0.05), 0px 4px 5px 0px rgba(0,0,0,0.08), 0px 2px 4px -1px rgba(0,0,0,0.12)',
    'radius: 4px',
  ],
  "light": [
    'textColor-9: rgba(0,0,0,0.90)',
    'textColor-6: rgba(0,0,0,0.60)',
    'textColor-1: rgba(0,0,0,1)',
    'textColor-4: rgba(0,0,0,0.40)',
    'textPrimaryColor: #7f838c',
    'textSecondColor: #171B27',
    'textDisabledColor: rgba(0, 0, 0, 0.6)',
    'textActiveColor: #0052d9',

    'buttonBg: #4583ff',
    'buttonDisabledBg: #b5c7ff',
    'buttonDisabledColor: #FFFFFF',
    'buttonGradient: linear-gradient(360deg,#4583ff, #33ccff)',

    'containerBg: #ffffff',
    'tabBg: #f1f2f5',
    'tabActiveBg: #4583ff',
    'tabDisabledBg: #e2e6ea',
    'tabDisabledColor: rgba(0,0,0,0.26)',
    'tabActiveColor: #ffffff',
    'formBg: #EFF1F4',
    'datePickerCellActiveRangeBg: #f2f3ff',
    'componentDisabledBg: #eee',
    'dataPickerCellActiveBg: #edefff',
    'activeBg: #f2f3ff',
    'popContentBg: #ffffff',
    'disabledBg: #7f838c',
    'disabledBg-2: #E2E6EA',

    'tableStripeColor: #f1f2f5',//表格斑马纹颜色
    'tableMenuBg: #ffffff', //表格上方菜单的背景色
    'tableMenuDividerBg: #e2e6ea', //表格上方菜单的分割线的背景色
    'tableMenuHandleBg: #ebedf1', //表格上方菜单手柄的背景色
    'tableMenuColor: rgba(0,0,0,0.60)', //表格上方菜单的颜色
    'tableMenuBorderColor: #e2e6ea', //表格上方菜单的颜色
    'tableColRowBg: #ebedf1', //表格col和row的背景色
    'tableColRowActiveBg: #bcc4d0', //表格上方菜单的active颜色
    'tableColRowColor: rgba(0,0,0,0.4)', //表格col和row的背景色

    'paginationColor: rgba(0,0,0,0.6)', //分页器的颜色
    'paginationActiveColor: #ffffff', //分页器的颜色
    'paginationActiveBg: #4583ff', //分页器的active颜色

    'sliderBg: #e2e6ea', //分页器的active颜色
    'sliderBtnBg: #ffffff', //分页器的active颜色

    'notificationBorderColor: transparent', //分页器的active颜色
    'notificationBg: #ffffff', //分页器的active颜色

    'borderColor: #d6dbe3',
    'borderOutsideColor: #d6dbe3',
    'formBorderColor: #d4d6d9',
    'borderInsideColor: #e7e7e7',

    'shadow: 0px 2px 4px 0px rgba(107,113,121,0.25)',
    'radius: 4px',
  ],
  /**
   * @description 将单驼峰命名的字符串改成 小写单词加-的形式,从而将js单驼峰的规范改成css变量的规范
   * @author Joseph Ho
   * @date 08/01/2025
   * @param {*} str
   * @returns {*}  
   */
  camelCaseToHyphenated(str) {
    return str.replace(/[A-Z]/g, (match) => {
        return '-' + match.toLowerCase();
    });
  },
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
      return `${this.vendor_css_prefix}${this.camelCaseToHyphenated(key.trim())}:${value.trim()}`;
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
    const _theme = theme || 'dark';
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
  addTheme(name,theme){
    Object.assign(this,{[name]:theme})
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
  getThemeObj(theme="dark"){
    // 将theme的list转换为对象
    const dot = ":";
    const obj = this[theme]?.reduce((acc, curr) => {
      const [key, value] = curr.split(dot);
      acc[key] = value;
      return acc;
    }, {});
    return obj;
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
    if(!styleSheet) return;
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