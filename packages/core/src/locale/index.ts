export type Meta2dTranslations = Record<string, string>;

type LocaleListener = (locale: string, translations: Meta2dTranslations) => void;

const locales: Record<string, Meta2dTranslations> = {
  en: {
    '确定': 'OK',
    '取消': 'Cancel',
    '确认执行操作吗？': 'Confirm this action?',
    '请输入': 'Enter text',
    '无': 'None',
    '搜索': 'Search',
    '暂无数据': 'No data',
    '请选择': 'Please select',
    '请选择日期': 'Select date',
    '可拖拽表格': 'Draggable table',
    '共': 'Total',
    '条数据': 'records',
    '每页': 'Per page',
    '条': 'items',
    '开始日期': 'Start date',
    '结束日期': 'End date',
    '开始周': 'Start week',
    '结束周': 'End week',
    '开始月份': 'Start month',
    '结束月份': 'End month',
    '开始年份': 'Start year',
    '结束年份': 'End year',
    '开始时间': 'Start time',
    '结束时间': 'End time',
    '时间': 'Time',
    '星期': 'Week ',
    '周': 'Week',
    '年': 'Year',
    '月': 'Month',
    '季度': 'Quarter',
    '日': 'Sun',
    '一': 'Mon',
    '二': 'Tue',
    '三': 'Wed',
    '四': 'Thu',
    '五': 'Fri',
    '六': 'Sat',
    '左插入列': 'Insert column left',
    '右插入列': 'Insert column right',
    '删除列': 'Delete column',
    '清空列': 'Clear column',
    '上插入行': 'Insert row above',
    '下插入行': 'Insert row below',
    '删除行': 'Delete row',
    '清空行': 'Clear row',
    '取消合并': 'Unmerge cells',
    '合并': 'Merge cells',
    '清空单元格': 'Clear cells',
    '导入Excel': 'Import Excel',
    '导出Excel': 'Export Excel',
    'SQL命令': 'SQL Command',
    '导入': 'Import',
    '导出': 'Export',
    '保存为图片': 'Save as image',
    '导出成功!': 'Exported successfully!',
    '导入成功!': 'Imported successfully!',
    '数据格式必需是二维数组!': 'Data must be a two-dimensional array!',
    '重试': 'Retry',
    '1月': 'January',
    '2月': 'February',
    '3月': 'March',
    '4月': 'April',
    '5月': 'May',
    '6月': 'June',
    '7月': 'July',
    '8月': 'August',
    '9月': 'September',
    '10月': 'October',
    '11月': 'November',
    '12月': 'December',
  },
};

let currentLocale = 'zh-CN';
const listeners = new Set<LocaleListener>();

export function t(zhText: string): string {
  if (currentLocale === 'zh-CN') return zhText;
  return locales[currentLocale]?.[zhText] ?? zhText;
}

export function setLocale(locale: string): void {
  if (currentLocale === locale) return;
  currentLocale = locale;
  notifyLocaleChange();
}

export function addLocale(locale: string, translations: Meta2dTranslations): void {
  locales[locale] = { ...(locales[locale] ?? {}), ...translations };
  if (locale === currentLocale) notifyLocaleChange();
}

export function onLocaleChange(listener: LocaleListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLocaleSnapshot(): { locale: string; translations: Meta2dTranslations } {
  return { locale: currentLocale, translations: { ...(locales[currentLocale] ?? {}) } };
}

function notifyLocaleChange(): void {
  const { locale, translations } = getLocaleSnapshot();
  listeners.forEach((listener) => listener(locale, translations));
}
