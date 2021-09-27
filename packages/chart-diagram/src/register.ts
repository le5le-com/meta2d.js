import { register as topologyRegister } from '@topology/core';

import { echarts, echartsList } from './echarts';
import { highcharts, highchartsList } from './highcharts';
declare const topology: any;

export function register(_echarts?: any) {
  echartsList.echarts = _echarts;
  if (!echartsList.echarts && !(echarts as any)) {
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
  highchartsList.hightcharts = _highcharts;
  if (!highchartsList.highcharts && !(highcharts as any)) {
    const loaderScript = document.createElement('script');
    loaderScript.type = 'text/javascript';
    loaderScript.src = 'http://cdn.highcharts.com.cn/highcharts/highcharts.js';
    loaderScript.addEventListener('load', () => {
      topology.render(Infinity);
    });
    document.body.appendChild(loaderScript);

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
