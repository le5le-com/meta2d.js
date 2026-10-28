import type { Bind, IotBind, Meta2d, Pen } from '@meta2d/core';
import { PatchFlag } from '@meta2d/core/src/models';

import * as echarts from 'echarts';
import type { EChartsOption, EChartsType } from 'echarts';
import { darkTheme, lightTheme } from './theme';

// 扩展包自行注册稳定主题名，确保编辑器素材和既有实例使用同一主题标识。
echarts.registerTheme('le-dark', darkTheme);
echarts.registerTheme('le-light', lightTheme);

export enum ReplaceMode {
  Add,
  Replace,
  ReplaceAll,
}

const funKeyWords = ['formatter', 'color'];

export interface EChartsPen extends Pen {
  echarts: {
    option: EChartsOption; // echarts 参数
    max: number; // 最大数据量
    replaceMode: ReplaceMode; // 替换模式
    theme: string; // 主题
    timeFormat: string; //格式化
    geoName?: string;
    geoJson?: any;
    geoUrl?: string;
    initJs?: string; // 初始化脚本
    diabled?: boolean; //通过脚本setOption后，禁止默认拿到echarts.option去设置图元
    replaceMerge?: string; // 替换合并
    timeKeys?: string[]; // 时间键
    dataMap?: any; // 数据映射，sql 查询结果的映射
    autoGetTime: boolean; // 趋势图是否自动获取时间
  };
}

interface ChartState {
  geoKey?: string;
  geoPromise?: Promise<void>;
  destroyed?: boolean;
}

type PlainObject = Record<string, unknown>;

const chartStates = new WeakMap<EChartsType, ChartState>();

function getChartState(instance: EChartsType): ChartState {
  let state = chartStates.get(instance);
  if (!state) {
    state = {};
    chartStates.set(instance, state);
  }
  return state;
}

/** 注册地图；内联数据优先，URL 数据异步加载。 */
function ensureGeoMap(pen: EChartsPen, instance: EChartsType): Promise<void> {
  const { geoName, geoJson, geoUrl } = pen.echarts || {};
  if (!geoName || echarts.getMap(geoName)) {
    return Promise.resolve();
  }

  const state = getChartState(instance);
  const key = `${geoName}|${geoUrl || ''}|${geoJson ? 'json' : ''}`;
  if (state.geoPromise && state.geoKey === key) {
    return state.geoPromise;
  }
  state.geoKey = key;

  if (geoJson) {
    try {
      echarts.registerMap(geoName, geoJson);
    } catch (error) {
      console.error('[meta2d:echarts] 注册地图失败。', { geoName, error });
    }
    state.geoPromise = Promise.resolve();
    return state.geoPromise;
  }
  if (!geoUrl) {
    state.geoPromise = Promise.resolve();
    return state.geoPromise;
  }

  state.geoPromise = fetch(geoUrl)
    .then(async (response) => {
      if (response.ok === false) {
        throw new Error(`地图请求失败（${response.status}）`);
      }
      let data: unknown = JSON.parse(await response.text());
      if (!data || typeof data !== 'object') {
        throw new Error('地图数据必须是对象或数组');
      }
      echarts.registerMap(geoName, data as any);
    })
    .catch((error) => {
      console.error('[meta2d:echarts] 加载地图失败。', { geoName, geoUrl, error });
    });
  return state.geoPromise;
}

/** 判断是否为普通对象，避免把数组、TypedArray 等 ECharts 合法数据误转换。 */
function isPlainObject(value: unknown): value is PlainObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** 判断对象键是否为可安全排序的非负整数索引。 */
function isNumericIndexKey(key: string): boolean {
  if (!/^(0|[1-9]\d*)$/.test(key)) {
    return false;
  }
  return Number.isSafeInteger(Number(key));
}

/** 将 series.data 的数字键对象按索引顺序转换为数组。 */
function normalizeSeriesData(option: unknown): void {
  if (!isPlainObject(option)) {
    return;
  }

  const seriesList = Array.isArray(option.series) ? option.series : [option.series];
  seriesList.forEach((series) => {
    if (!isPlainObject(series) || !isPlainObject(series.data)) {
      return;
    }

    const data = series.data;
    const keys = Object.keys(data);
    if (keys.length > 0 && !keys.every(isNumericIndexKey)) {
      return;
    }

    // JSON 对象的键顺序不应作为数据顺序依据，始终按数字索引升序生成数组。
    keys.sort((left, right) => Number(left) - Number(right));
    series.data = keys.map((key) => data[key]);
  });
}

/** 克隆 option，并把 formatter、color 函数字符串转换为函数。 */
function normalizeOption(option: unknown): unknown {
  const value: any = structuredClone(option);
  const walk = (item: any): any => {
    if (Array.isArray(item)) {
      item.forEach((child, index) => (item[index] = walk(child)));
      return item;
    }
    if (!item || typeof item !== 'object') return item;
    Object.keys(item).forEach((key) => {
      const child = item[key];
      if (
        funKeyWords.includes(key) &&
        typeof child === 'string' &&
        /^(?:function(?:\s+\w+)?\s*\([^)]*\)\s*\{[\s\S]*\}|(?:\([^)]*\)|\w+)\s*=>\s*(?:\{[\s\S]*\}|[^{}]+))$/.test(
          child.trim(),
        )
      ) {
        try {
          item[key] = new Function(`return (${child})`)();
          return;
        } catch (error) {
          console.error('[meta2d:echarts] 转换函数配置失败。', { key, value: child, error });
        }
      }
      item[key] = walk(child);
    });
    return item;
  };
  const normalizedOption = walk(value);
  normalizeSeriesData(normalizedOption);
  return normalizedOption;
}

function safeSetOption(instance: EChartsType | undefined, option: unknown): boolean {
  if (!instance || option == null) {
    return false;
  }
  try {
    instance.setOption(normalizeOption(option) as EChartsOption);
    return true;
  } catch (error) {
    // setOption 可能在抛错前已写入部分模型，清空实例可避免后续 resize 或导出再次失败。
    try {
      instance.clear();
    } catch {}
    console.warn('[meta2d:echarts] 图表 option 无法应用，已隔离异常以保证画布继续绘制。', { option, error });
    return false;
  }
}

/** 执行图表初始化脚本；脚本返回值作为 option 应用到当前实例。 */
async function runInitJs(meta2d: Meta2d, pen: EChartsPen, instance: EChartsType): Promise<void> {
  const source = pen.echarts?.initJs?.trim();
  if (!source) {
    safeSetOption(instance, pen.echarts?.option);
    return;
  }

  try {
    const execute = new Function(
      'myChart',
      'context',
      `return (async function () { ${source}\n })();`,
    ) as (myChart: EChartsType, context: { meta2d: Meta2d; pen: EChartsPen }) => Promise<unknown>;
    const option = await execute(instance, { meta2d, pen });
    if (option != null && safeSetOption(instance, option)) {
      // 初始化脚本可能动态生成完整 option，需要同步回写供后续更新使用。
      pen.echarts.option = instance.getOption() as EChartsOption;
    }
  } catch (error) {
    console.error('[meta2d:echarts] 执行初始化脚本失败。', { penId: pen.id, error });
  }
}

/** 从 ECharts 实例获取内部渲染容器。 */
function getChartElement(instance?: EChartsType): HTMLDivElement | undefined {
  return instance?.getDom() as HTMLDivElement | undefined;
}

/** 设置内部容器的逻辑尺寸，避免把画布缩放值写入图表布局。 */
function setChartElementSize(element: HTMLDivElement, pen: EChartsPen): void {
  element.style.width = `${pen.width}px`;
  element.style.height = `${pen.height}px`;
}

/** 仅缩放 ECharts 内容，不改变外层图元的位置和布局尺寸。 */
function setChartElementScale(element: HTMLDivElement, scale: number): void {
  const normalizedScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  element.style.transform = normalizedScale === 1 ? 'none' : `scale(${normalizedScale})`;
}

export function create(this: Meta2d, pen: EChartsPen): HTMLElement | void {
  if (!pen.echarts) {
    return;
  }

  let div = this.componentElementMap.get(pen.id);
  if (div) {
    return div;
  }

  if (typeof pen.echarts === 'string') {
    try {
      pen.echarts = JSON.parse(pen.echarts);
    } catch (e) {}
  }
  pen.echarts.theme = this.data.theme === 'light' ? 'le-light' : 'le-dark';
  const scale = this.data.scale;
  div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.outline = 'none';
  div.style.left = pen.x * scale + this.data.x + 'px';
  div.style.top = pen.y * scale + this.data.y + 'px';
  div.style.width = pen.width * scale + 'px';
  div.style.height = pen.height * scale + 'px';

  // 外层容器由 Meta2d 管理位置和图元边界，内层容器保持逻辑尺寸并负责视觉缩放。
  const chartElement = document.createElement('div');
  chartElement.style.position = 'absolute';
  chartElement.style.left = '0';
  chartElement.style.top = '0';
  chartElement.style.transformOrigin = '0 0';
  setChartElementSize(chartElement, pen);
  setChartElementScale(chartElement, scale);
  chartElement.innerText = pen.name || pen.type;
  div.appendChild(chartElement);

  if (pen.isBottom) {
    this.bottomElement.appendChild(div);
  } else {
    this.topElement.appendChild(div);
  }
  const instance = echarts.init(chartElement, pen.echarts.theme);

  this.componentElementMap.set(pen.id, div);
  this.componentInstanceMap.set(pen.id, instance);

  const state = getChartState(instance);
  state.destroyed = false;
  const waitingForGeoUrl =
    !!pen.echarts.geoName &&
    !echarts.getMap(pen.echarts.geoName) &&
    !pen.echarts.geoJson &&
    !!pen.echarts.geoUrl;
  if (!waitingForGeoUrl && !pen.echarts.initJs?.trim()) {
    // 普通图表及内联地图保持同步初始化，兼容原有 create 调用时序。
    void ensureGeoMap(pen, instance);
    safeSetOption(instance, pen.echarts.option);
    state.geoPromise = Promise.resolve();
  } else {
    state.geoPromise = ensureGeoMap(pen, instance)
      .then(() => {
        if (state.destroyed || this.componentInstanceMap.get(pen.id) !== instance) return;
        return runInitJs(this, pen, instance);
      })
      .catch((error) => console.error('[meta2d:echarts] 初始化图表失败。', { penId: pen.id, error }));
  }

  return div;
}

/** 按 1.0 的时间表达式格式化聚合时间，纳秒时间戳先转换为毫秒。 */
function formatAggregateTime(timestamp: string, format?: string): string {
  const time = Number(timestamp) / (/^\d{19}$/.test(timestamp) ? 1000000 : 1);
  const date = new Date(time);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const defaultTime = `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
  if (!format) return defaultTime;

  try {
    const formatter = new Function(
      'year',
      'month',
      'day',
      'week',
      'hours',
      'minutes',
      'seconds',
      `return ${format}`,
    ) as (...args: Array<string | number>) => string;
    const week = ['天', '一', '二', '三', '四', '五', '六'][date.getDay()];
    return formatter(year, month, day, week, hours, minutes, seconds);
  } catch {
    return defaultTime;
  }
}

/** 将本次物联网聚合系列按时间对齐，通过路径补丁交给现有更新流程。 */
export function beforeUpdate(this: Meta2d, pen: EChartsPen): boolean {
  const value = pen.__val;
  if (!value || Object.prototype.hasOwnProperty.call(value, 'echarts') || !pen.echarts?.option) {
    return true;
  }
  // le5le iot 聚合
  const series = new Map<string, Map<string, unknown>>();
  const timestamps = new Set<string>();
  const isIotBind = (bind?: Bind | IotBind): bind is IotBind => bind?.class === 'iot';
  for (const property of pen.properties || []) {
    const key = property.key;
    if (
      !isIotBind(property.bind) ||
      !property.bind.compute_name ||
      !key ||
      !/^echarts\.option\.series(?:\.\d+)?\.data$/.test(key) ||
      !Object.prototype.hasOwnProperty.call(value, key)
    ) {
      continue;
    }

    const data: unknown = value[key];
    // 整个系列必须是时间值对；空数组表示清空，普通数值数组保持原样。
    if (
      !Array.isArray(data) ||
      !data.every((item): item is [number | string, unknown] =>
        Array.isArray(item) && item.length === 2 &&
        (typeof item[0] === 'number' || (typeof item[0] === 'string' && item[0].trim() !== '')) &&
        Number.isFinite(Number(item[0]))
      )
    ) {
      continue;
    }

    const points = new Map<string, unknown>();
    for (const [timestamp, point] of data) {
      // 保留原始时间键，避免 19 位时间戳转为数字后合并不同采样点。
      const time = String(timestamp);
      points.set(time, point);
      timestamps.add(time);
    }
    series.set(key, points);
  }
  if (!series.size) return true;

  const times = [...timestamps].sort((left, right) => Number(left) - Number(right));
  pen.pathVals ||= {};
  // __val 仅用于识别本次输入；真正发往 Worker 的路径更新必须写入 pathVals。
  for (const [key, points] of series) {
    pen.pathVals[key] = times.map((time) => points.get(time));
  }
  const axisKey = Array.isArray(pen.echarts.option.xAxis)
    ? 'echarts.option.xAxis.0.data'
    : 'echarts.option.xAxis.data';
  pen.pathVals[axisKey] = times.map((time) => formatAggregateTime(time, pen.echarts.timeFormat));
  return true;
}

export function afterUpdate(this: Meta2d, pen: EChartsPen, values: any): void {
  if (!values?.echarts && !(values?.patchFlag & PatchFlag.Rect)) {
    return;
  }

  const instance = this.componentInstanceMap.get(pen.id) as EChartsType | undefined;
  const chartElement = getChartElement(instance);
  if (values.echarts && instance) {
    const state = getChartState(instance);
    // 首次初始化或地图加载尚未完成时，更新操作排队到初始化任务之后；
    // 每次更新都重新检查最新地图配置，避免 geoUrl/geoJson 变更后直接 setOption。
    const waitForInit = state.geoPromise || Promise.resolve();
    state.geoPromise = waitForInit
      .then(() => ensureGeoMap(pen, instance))
      .then(() => {
        if (!state.destroyed && this.componentInstanceMap.get(pen.id) === instance) {
          safeSetOption(instance, pen.echarts?.option);
        }
      })
      .catch((error) => {
        console.error('[meta2d:echarts] 更新图表失败。', { penId: pen.id, error });
      });
  }

  if (values.patchFlag & PatchFlag.Rect && chartElement) {
    setChartElementSize(chartElement, pen);
    setChartElementScale(chartElement, this.data.scale || 1);
  }
  if (values.patchFlag & PatchFlag.Rect && instance) {
    instance.resize();
  }
}

export function scale(this: Meta2d, pen: EChartsPen, scale: number): void {
  const instance = this.componentInstanceMap.get(pen.id) as EChartsType | undefined;
  const chartElement = getChartElement(instance);
  if (chartElement) {
    setChartElementScale(chartElement, scale);
  }
}

/** ECharts 不支持原地更换主题，因此保留配置并在原容器中重建实例。 */
export function changeTheme(this: Meta2d, pen: EChartsPen): void {
  if (!pen.echarts) {
    return;
  }
  const oldInstance = this.componentInstanceMap.get(pen.id) as EChartsType | undefined;
  const chartElement = getChartElement(oldInstance);
  const option = oldInstance?.getOption() || pen.echarts.option;
  const theme = this.data.theme === 'light' ? 'le-light' : 'le-dark';
  if (pen.echarts.theme === theme && oldInstance) {
    return;
  }
  pen.echarts.theme = theme;
  if (!chartElement) {
    return;
  }

  oldInstance?.dispose();
  const instance = echarts.init(chartElement, theme);
  safeSetOption(instance, option);
  this.componentInstanceMap.set(pen.id, instance);
}

export async function toPng(this: Meta2d, pen: EChartsPen): Promise<ImageBitmap> {
  const instance = this.componentInstanceMap.get(pen.id);
  if (!instance) {
    return;
  }

  const base64 = instance.getDataURL({ type: 'png' });
  const arr = base64.split(','),
    mime = arr[0].match(/:(.*?);/)[1],
    bstr = atob(arr[1]),
    n = bstr.length,
    u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }

  return await createImageBitmap(new Blob([u8arr], { type: mime }));
}

export function destroy(this: Meta2d, pen: EChartsPen): void {
  const instance = this.componentInstanceMap.get(pen.id) as EChartsType | undefined;
  if (instance) {
    const state = getChartState(instance);
    state.destroyed = true;
    state.geoPromise = undefined;
  }
  if (instance) {
    instance.dispose();
  }
  const div = this.componentElementMap.get(pen.id);
  if (div) {
    div.remove();
  }
  this.componentElementMap.delete(pen.id);
  this.componentInstanceMap.delete(pen.id);
  if (instance) {
    chartStates.delete(instance);
  }
}
