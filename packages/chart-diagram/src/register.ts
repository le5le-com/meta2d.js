import { register as topologyRegister, Topology } from '@topology/core';

import { echarts, echartsList } from './echarts';
import { highcharts, highchartsList } from './highcharts';
import { lightningCharts, lightningChartsList } from './LightningChart';
declare const topology: Topology;
declare const window: Window;

export function register(_echarts?: any) {
  echartsList.echarts = _echarts;
  if (!echartsList.echarts && !(window as any).echarts) {
    loadJS(
      'https://cdn.bootcdn.net/ajax/libs/echarts/5.1.2/echarts.min.js',
      undefined,
      true
    );
  }
  topologyRegister({ echarts });
}

export function registerHighcharts(_highcharts?: any) {
  highchartsList.highcharts = _highcharts;
  if (!highchartsList.highcharts && !(window as any).Highcharts) {
    loadJS('http://cdn.highcharts.com.cn/highcharts/highcharts.js', () => {
      // load 成功后再引入 more 文件
      loadJS(
        'http://cdn.highcharts.com.cn/highcharts/highcharts-more.js',
        undefined,
        true
      );
    });
  }
  topologyRegister({ highcharts });
}

export function registerLightningChart(_lightningCharts?: any) {
  lightningChartsList.lightningChart = _lightningCharts;
  if (!lightningChartsList.lightningChart && !(window as any).lcjs) {
    loadJS('/js/lcjs.iife.js', undefined, true);
  }
  topologyRegister({ lightningCharts });
}

/**
 * 动态添加 script 标签，挂载到 body 上
 * @param url script 标签的 src 属性
 * @param callback 引入成功后回调
 * @param render 是否立即渲染 topology 画布
 */
function loadJS(url: string, callback?: () => void, render?: boolean) {
  const loaderScript = document.createElement('script');
  loaderScript.type = 'text/javascript';
  loaderScript.src = url;
  loaderScript.addEventListener('load', () => {
    callback?.();
    render && topology.render(Infinity);
  });
  document.body.appendChild(loaderScript);
}
