export type Meta2dTranslations = Record<string, string>;

const locales: Record<string, Meta2dTranslations> = {
  en: {
    // popconfirm / dialog
    '确定': 'OK',
    '取消': 'Cancel',
    '确认执行操作吗？': 'Confirm this action?',
    // canvas / input
    '请输入': 'Enter text',
    '无': 'None',
    // sliderVerify
    '请按住滑块，拖动到最右边完成验证': 'Hold and drag the slider to the right',
    '验证成功': 'Verified',
    // cascadeFilter / treeFilter
    '搜索': 'Search',
    '暂无数据': 'No data',
    '请选择': 'Please select',
    // tablePlus
    '可拖拽表格': 'Draggable table',
    'SQL命令': 'SQL Command',
    '共': 'Total',
    '条数据': 'records',
    // pagination
    '每页': 'Per page',
    '条': 'items',
    // dropDown placeholder fallback
    '测试': 'Test',
    // dateRangePicker placeholders
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
    // calendar
    '时间': 'Time',
    // time component
    '星期': 'Week ',
    // 星期头
    '日': 'Sun',
    '一': 'Mon',
    '二': 'Tue',
    '三': 'Wed',
    '四': 'Thu',
    '五': 'Fri',
    '六': 'Sat',
    // 星期完整（time 组件用）
  },
};

let currentLocale = 'zh-CN';

export function t(zhText: string): string {
  if (currentLocale === 'zh-CN') return zhText;
  return locales[currentLocale]?.[zhText] ?? zhText;
}

export function setLocale(locale: string): void {
  currentLocale = locale;
}

export function addLocale(locale: string, translations: Meta2dTranslations): void {
  locales[locale] = { ...(locales[locale] ?? {}), ...translations };
}
