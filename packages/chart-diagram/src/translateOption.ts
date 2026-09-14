import { t } from '@meta2d/core';
import type { EChartsOption } from 'echarts';

/**
 * 自动翻译 ECharts option 中的用户可见文本
 * @param option ECharts 配置对象
 * @returns 翻译后的配置对象
 *
 * @example
 * ```typescript
 * import { translateEchartsOption } from '@meta2d/chart-diagram';
 *
 * const option = {
 *   title: { text: '销售趋势图' },
 *   xAxis: { name: '月份', data: ['1月', '2月', '3月'] },
 *   yAxis: { name: '销量' },
 *   series: [{ name: '产品A', type: 'line', data: [120, 200, 150] }]
 * };
 *
 * const translatedOption = translateEchartsOption(option);
 * meta2d.setValue({ id: 'chart1', echarts: { option: translatedOption } });
 * ```
 */
export function translateEchartsOption(option: EChartsOption): EChartsOption {
  if (!option || typeof option !== 'object') {
    return option;
  }

  // 深拷贝，避免修改原对象
  const translated = JSON.parse(JSON.stringify(option));

  // 需要翻译文本的属性名
  const textKeys = new Set([
    'text',      // title.text, title.subtext, 各种 text 属性
    'subtext',
    'name',      // series[].name, xAxis.name, yAxis.name, data[].name
    'label',     // 各种标签文本
    'placeholder', // 输入框占位符
  ]);

  // 跳过翻译的属性名（技术性内容）
  const skipKeys = new Set([
    'type',      // 图表类型
    'id',        // ID
    'formatter', // 格式化函数（包含动态逻辑）
    'color',     // 颜色函数
    'emphasis',  // 强调样式
    'itemStyle', // 样式配置
    'lineStyle',
    'areaStyle',
    'textStyle',
    'axisLabel',
  ]);

  /**
   * 递归翻译对象
   */
  function translateObj(obj: any, parentKey?: string): any {
    // 处理数组
    if (Array.isArray(obj)) {
      return obj.map((item, index) => translateObj(item, parentKey));
    }

    // 处理字符串
    if (typeof obj === 'string') {
      // 如果父键是需要翻译的属性，则翻译
      if (parentKey && textKeys.has(parentKey)) {
        return t(obj);
      }
      return obj;
    }

    // 处理函数（保持原样）
    if (typeof obj === 'function') {
      return obj;
    }

    // 处理对象
    if (obj && typeof obj === 'object') {
      const result: any = {};

      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;

        // 跳过需要保持原样的属性
        if (skipKeys.has(key)) {
          result[key] = obj[key];
          continue;
        }

        // 递归处理
        result[key] = translateObj(obj[key], key);
      }

      return result;
    }

    return obj;
  }

  return translateObj(translated);
}

/**
 * 翻译 ECharts 数据数组（用于 xAxis.data, legend.data 等）
 * @param data 数据数组
 * @returns 翻译后的数组
 *
 * @example
 * ```typescript
 * const months = translateEchartsData(['1月', '2月', '3月']);
 * // => ['Jan', 'Feb', 'Mar'] (英文环境下)
 * ```
 */
export function translateEchartsData(data: any[]): any[] {
  if (!Array.isArray(data)) {
    return data;
  }

  return data.map(item => {
    if (typeof item === 'string') {
      return t(item);
    }
    if (item && typeof item === 'object' && item.name) {
      return {
        ...item,
        name: t(item.name)
      };
    }
    return item;
  });
}
