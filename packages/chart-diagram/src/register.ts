import { register as topologyRegister, Topology } from '@topology/core';

import { echarts, echartsList } from './echarts';
import { highcharts, highchartsList } from './highcharts';
import { lightningCharts, lightningChartsList } from './LightningChart';
declare const topology: Topology;
declare const window: Window;

export function register(_echarts?: any) {
  echartsList.echarts = _echarts;
  if (!echartsList.echarts && !(window as any).echarts) {
    const loaderScript = document.createElement('script');
    loaderScript.type = 'text/javascript';
    loaderScript.src =
      'https://cdn.bootcdn.net/ajax/libs/echarts/5.1.2/echarts.min.js';
    loaderScript.addEventListener('load', () => {
      topology.render(Infinity);
    });
    document.body.appendChild(loaderScript);
  }
  topologyRegister({ echarts });
}

export function registerHighcharts(_highcharts?: any) {
  highchartsList.highcharts = _highcharts;
  if (!highchartsList.highcharts && !(window as any).Highcharts) {
    const loaderScript = document.createElement('script');
    loaderScript.type = 'text/javascript';
    loaderScript.src = 'http://cdn.highcharts.com.cn/highcharts/highcharts.js';
    loaderScript.addEventListener('load', () => {
      topology.render(Infinity);
    });
    document.body.appendChild(loaderScript);

    const mloaderScript = document.createElement('script');
    mloaderScript.type = 'text/javascript';
    mloaderScript.src =
      'https://cdn.highcharts.com.cn/highcharts/highcharts-more.js';
    mloaderScript.addEventListener('load', () => {
      topology.render(Infinity);
    });
    document.body.appendChild(mloaderScript);
    // const loaderScriptexport = document.createElement('script');
    // loaderScriptexport.type = 'text/javascript';
    // loaderScriptexport.src =
    //   'http://cdn.highcharts.com.cn/highcharts/9.2.2/modules/exporting.js';
    // loaderScriptexport.addEventListener('load', () => {
    //   topology.render(Infinity);
    // });
    // document.body.appendChild(loaderScriptexport);

    // const loaderScriptoffline = document.createElement('script');
    // loaderScriptoffline.type = 'text/javascript';
    // loaderScriptoffline.src =
    //   'http://cdn.highcharts.com.cn/highcharts/9.2.2/modules/offline-exporting.js';
    // loaderScriptoffline.addEventListener('load', () => {
    //   topology.render(Infinity);
    // });
    // document.body.appendChild(loaderScriptoffline);
  }
  topologyRegister({ highcharts });
}

export function registerLightningChart(_lightningCharts?: any) {
  lightningChartsList.lightningChart = _lightningCharts;
  if (!lightningChartsList.lightningChart && !(window as any).lcjs) {
    const loaderScript = document.createElement('script');
    loaderScript.type = 'text/javascript';
    loaderScript.src = 'js/lcjs.iife.js';  // TODO: 必须放在该路径下的 lcjs 才可以正常使用
    loaderScript.addEventListener('load', () => {
      topology.render(Infinity);
    });
    document.body.appendChild(loaderScript);
  }
  topologyRegister({ lightningCharts });
}
