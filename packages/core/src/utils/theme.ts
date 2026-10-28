import type { Meta2d } from '../meta2d';
import { changeThemeFns } from '../models';
import { WorkerMessage } from '../types/message';

export type ThemeVariables = Record<string, string>;

export interface Meta2dTheme {
  color: string;
  background: string;
  parentBackground: string;
  ruleColor: string;
  ruleOptions: {
    background: string;
    textColor: string;
  };
  variables: ThemeVariables;
}

export type ThemeInput =
  | string[]
  | (Partial<Omit<Meta2dTheme, 'ruleOptions' | 'variables'>> & {
      ruleOptions?: Partial<Meta2dTheme['ruleOptions']>;
      variables?: ThemeVariables;
    })
  | ThemeVariables;

/** @deprecated 请使用 Meta2dTheme。 */
export interface Theme {
  [key: string]: Partial<Omit<Meta2dTheme, 'ruleOptions'>> & {
    ruleOptions?: Partial<Meta2dTheme['ruleOptions']> & { color?: string };
  };
}

const darkVariables: ThemeVariables = {
  'textColor-9': 'rgba(255,255,255,0.90)',
  'textColor-6': 'rgba(255,255,255,0.60)',
  'textColor-1': 'rgba(255,255,255,1)',
  'textColor-4': 'rgba(255,255,255,0.40)',
  textPrimaryColor: '#7f838c',
  textSecondColor: 'rgba(255,255,255,0.90)',
  textDisabledColor: 'rgba(255,255,255,0.40)',
  textActiveColor: '#0052d9',
  buttonBg: '#4583ff',
  buttonDisabledBg: '#0057CC',
  buttonDisabledColor: '#FFFFFF26',
  buttonGradient: 'linear-gradient(360deg,#4583ff, #33ccff)',
  containerBg: 'rgba(21,24,28,0.95)',
  tabBg: '#303746',
  tabActiveBg: '#4583ff',
  tabDisabledBg: '#282e3b',
  tabDisabledColor: 'rgba(255,255,255,0.26)',
  tabActiveColor: 'rgba(255,255,255,0.90)',
  formBg: '#2a2f36',
  datePickerCellActiveRangeBg: '#2c4475',
  componentDisabledBg: '#282e3b',
  dataPickerCellActiveBg: '#001b52',
  activeBg: '#25375b',
  hoverBg: '#303746',
  tagBg: '#25375b',
  popContentBg: '#252b37',
  disabledBg: '#7f838c',
  'disabledBg-2': '#282E3B',
  tableStripeColor: 'rgba(150,192,255,0.10)',
  tableMenuBg: '#303746',
  tableMenuDividerBg: 'rgb(76 81 94)',
  tableMenuHandleBg: '#454f64',
  tableMenuColor: '#bdc7db',
  tableMenuBorderColor: 'transparent',
  tableColRowBg: '#303746',
  tableColRowActiveBg: '#4A5263',
  tableColRowColor: 'rgba(255,255,255,0.6)',
  paginationColor: 'rgba(255,255,255,0.6)',
  paginationActiveColor: '#4583ff',
  paginationActiveBg: 'rgba(69,131,255,0.20)',
  sliderBg: '#303746',
  sliderBtnBg: '#000000',
  notificationBorderColor: 'transparent',
  notificationBg: '#282e3b',
  borderColor: '#424b61',
  borderOutsideColor: '#4583ff',
  formBorderColor: '#424b61',
  borderInsideColor: 'rgba(255,255,255,0.40)',
  shadow:
    '0px 1px 10px 0px rgba(0,0,0,0.05), 0px 4px 5px 0px rgba(0,0,0,0.08), 0px 2px 4px -1px rgba(0,0,0,0.12)',
  radius: '4px',
};

const lightVariables: ThemeVariables = {
  'textColor-9': 'rgba(0,0,0,0.90)',
  'textColor-6': 'rgba(0,0,0,0.60)',
  'textColor-1': 'rgba(0,0,0,1)',
  'textColor-4': 'rgba(0,0,0,0.40)',
  textPrimaryColor: '#7f838c',
  textSecondColor: '#171B27',
  textDisabledColor: 'rgba(0, 0, 0, 0.6)',
  textActiveColor: '#0052d9',
  buttonBg: '#4583ff',
  buttonDisabledBg: '#b5c7ff',
  buttonDisabledColor: '#FFFFFF',
  buttonGradient: 'linear-gradient(360deg,#4583ff, #33ccff)',
  containerBg: '#ffffff',
  tabBg: '#f1f2f5',
  tabActiveBg: '#4583ff',
  tabDisabledBg: '#e2e6ea',
  tabDisabledColor: 'rgba(0,0,0,0.26)',
  tabActiveColor: '#ffffff',
  formBg: '#EFF1F4',
  datePickerCellActiveRangeBg: '#f2f3ff',
  componentDisabledBg: '#eee',
  dataPickerCellActiveBg: '#edefff',
  activeBg: '#f2f3ff',
  hoverBg: '#f1f2f5',
  tagBg: '#f2f3ff',
  popContentBg: '#ffffff',
  disabledBg: '#7f838c',
  'disabledBg-2': '#E2E6EA',
  tableStripeColor: '#f1f2f5',
  tableMenuBg: '#ffffff',
  tableMenuDividerBg: '#e2e6ea',
  tableMenuHandleBg: '#ebedf1',
  tableMenuColor: 'rgba(0,0,0,0.60)',
  tableMenuBorderColor: '#e2e6ea',
  tableColRowBg: '#ebedf1',
  tableColRowActiveBg: '#bcc4d0',
  tableColRowColor: 'rgba(0,0,0,0.4)',
  paginationColor: 'rgba(0,0,0,0.6)',
  paginationActiveColor: '#ffffff',
  paginationActiveBg: '#4583ff',
  sliderBg: '#e2e6ea',
  sliderBtnBg: '#ffffff',
  notificationBorderColor: 'transparent',
  notificationBg: '#ffffff',
  borderColor: '#d6dbe3',
  borderOutsideColor: '#d6dbe3',
  formBorderColor: '#d4d6d9',
  borderInsideColor: '#e7e7e7',
  shadow: '0px 2px 4px 0px rgba(107,113,121,0.25)',
  radius: '4px',
};

const defaultThemes: Readonly<Record<'dark' | 'light', Meta2dTheme>> = {
  dark: {
    color: '#bdc7db',
    background: '#1e2430',
    parentBackground: '#080b0f',
    ruleColor: '#222E47',
    ruleOptions: { background: '#121924', textColor: '#6E7B91' },
    variables: darkVariables,
  },
  light: {
    color: '#222222',
    background: '#FFFFFF',
    parentBackground: '#F0F1F2',
    ruleColor: '#C8D0E1',
    ruleOptions: { background: '#F7F8FA', textColor: '#C8D0E1' },
    variables: lightVariables,
  },
};

interface ThemeState {
  registry: Map<string, Meta2dTheme>;
  styleElement?: HTMLStyleElement;
}

function cloneTheme(theme: Meta2dTheme): Meta2dTheme {
  return {
    ...theme,
    ruleOptions: { ...theme.ruleOptions },
    variables: { ...theme.variables },
  };
}

function camelCaseToKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function normalizeVariableName(name: string): string {
  const value = name.trim().replace(/^--le-/, '');
  if (!value.includes('-')) {
    return value;
  }
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function parseVariables(input: string[] | ThemeVariables): ThemeVariables {
  if (!Array.isArray(input)) {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [normalizeVariableName(key), String(value).trim()])
    );
  }

  const variables: ThemeVariables = {};
  input.forEach((declaration) => {
    const separator = declaration.indexOf(':');
    if (separator <= 0 || separator === declaration.length - 1) {
      throw new Error(`无效的主题变量：${declaration}`);
    }
    const key = normalizeVariableName(declaration.slice(0, separator));
    const value = declaration.slice(separator + 1).trim().replace(/;$/, '');
    if (!key || !value) {
      throw new Error(`无效的主题变量：${declaration}`);
    }
    variables[key] = value;
  });
  return variables;
}

function normalizeTheme(input: ThemeInput, base = defaultThemes.dark): Meta2dTheme {
  if (Array.isArray(input)) {
    return { ...cloneTheme(base), variables: { ...base.variables, ...parseVariables(input) } };
  }

  const structured =
    'variables' in input ||
    'ruleOptions' in input ||
    'color' in input ||
    'background' in input ||
    'parentBackground' in input ||
    'ruleColor' in input;
  if (!structured) {
    return { ...cloneTheme(base), variables: { ...base.variables, ...parseVariables(input as ThemeVariables) } };
  }

  const value = input as Partial<Meta2dTheme>;
  return {
    color: value.color ?? base.color,
    background: value.background ?? base.background,
    parentBackground: value.parentBackground ?? base.parentBackground,
    ruleColor: value.ruleColor ?? base.ruleColor,
    ruleOptions: { ...base.ruleOptions, ...value.ruleOptions },
    variables: { ...base.variables, ...parseVariables(value.variables ?? {}) },
  };
}

function themeToStyleText(theme: Meta2dTheme): string {
  const declarations = Object.entries(theme.variables)
    .map(([key, value]) => `--le-${camelCaseToKebabCase(key)}: ${value};`)
    .join(' ');
  return `:host { ${declarations} }`;
}

class ThemeManager {
  private states = new WeakMap<Meta2d, ThemeState>();

  private getState(meta2d: Meta2d): ThemeState {
    let state = this.states.get(meta2d);
    if (!state) {
      state = {
        registry: new Map(Object.entries(defaultThemes).map(([name, theme]) => [name, cloneTheme(theme)])),
      };
      this.states.set(meta2d, state);
    }
    return state;
  }

  private updateElementBackground(meta2d: Meta2d) {
    if (meta2d.data.width) {
      meta2d.style.background = 'none';
      return;
    }
    meta2d.style.background = meta2d.data.background || meta2d.options.background || '#fff';
  }

  init(meta2d: Meta2d) {
    this.ensureStyle(meta2d);
  }

  ensureStyle(meta2d: Meta2d) {
    const state = this.getState(meta2d);
    if (!state.styleElement) {
      state.styleElement = document.createElement('style');
      state.styleElement.id = 'meta2d-theme-style';
      meta2d.shadowRoot.appendChild(state.styleElement);
    }
    const theme = state.registry.get(meta2d.data.theme || 'dark') || defaultThemes.dark;
    state.styleElement.textContent = themeToStyleText(theme);
  }

  register(meta2d: Meta2d, name: string, input: ThemeInput): Meta2dTheme | undefined {
    if (!name?.trim()) {
      console.warn('主题名称不能为空。');
      return;
    }
    try {
      const state = this.getState(meta2d);
      const theme = normalizeTheme(input, state.registry.get('dark') || defaultThemes.dark);
      state.registry.set(name, theme);
      return cloneTheme(theme);
    } catch (error) {
      console.warn(`注册主题 ${name} 失败：`, error);
      return;
    }
  }

  apply(meta2d: Meta2d, name: string): Meta2dTheme {
    const state = this.getState(meta2d);
    const resolvedName = state.registry.has(name) ? name : 'dark';
    if (resolvedName !== name) {
      console.warn(`未找到主题 ${name}，已回退到 dark。`);
    }
    const theme = state.registry.get(resolvedName) || defaultThemes.dark;
    meta2d.data.theme = resolvedName;
    meta2d.data.background = theme.background;
    meta2d.data.color = theme.color;
    meta2d.data.textColor = theme.color;
    meta2d.data.rule = {
      ...meta2d.data.rule,
      color: theme.ruleColor,
      background: theme.ruleOptions.background,
      textColor: theme.ruleOptions.textColor,
    };
    meta2d.options.background = theme.background;
    meta2d.options.color = theme.color;
    meta2d.options.textColor = theme.color;
    meta2d.options.rule = {
      ...meta2d.options.rule,
      color: theme.ruleColor,
      background: theme.ruleOptions.background,
      textColor: theme.ruleOptions.textColor,
    };
    this.ensureStyle(meta2d);
    state.styleElement.textContent = themeToStyleText(theme);
    this.updateElementBackground(meta2d);
    if (meta2d.parentElement) {
      meta2d.parentElement.style.background = theme.parentBackground;
    }
    return theme;
  }

  notify(meta2d: Meta2d, theme: Meta2dTheme) {
    for (const pen of meta2d.penMap.values()) {
      try {
        changeThemeFns[pen.type]?.call(meta2d, pen, { ...theme.variables });
      } catch (error) {
        console.warn(`图元 ${pen.id || pen.type} 切换主题失败：`, error);
      }
    }
  }

  set(meta2d: Meta2d, name: string): string {
    const theme = this.apply(meta2d, name);
    const data = {
      theme: meta2d.data.theme,
      background: meta2d.data.background,
      color: meta2d.data.color,
      textColor: meta2d.data.textColor,
      rule: meta2d.data.rule,
    };
    const options = {
      background: meta2d.options.background,
      color: meta2d.options.color,
      textColor: meta2d.options.textColor,
      rule: meta2d.options.rule,
    };

    [meta2d.renderWorker, meta2d.calcWorker, meta2d.hoverWorker, meta2d.utilityWorker].forEach((worker) => {
      worker?.postMessage({ action: WorkerMessage.Option, data, options });
    });
    this.notify(meta2d, theme);
    meta2d.emitter.emit('changeTheme', { name: meta2d.data.theme, theme: cloneTheme(theme) });
    return meta2d.data.theme;
  }

  destroyStyle(meta2d: Meta2d) {
    const state = this.states.get(meta2d);
    state?.styleElement?.remove();
    if (state) {
      state.styleElement = undefined;
    }
  }
}

export const themeManager = new ThemeManager();
