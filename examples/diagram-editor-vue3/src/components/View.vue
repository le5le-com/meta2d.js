<template>
  <div id="meta2d"></div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted } from 'vue';
import {
  Meta2d,
  Pen,
  register,
  registerAnchors,
  registerCanvasDraw,
} from '@meta2d/core';
import { flowPens, flowAnchors } from '@meta2d/flow-diagram';
import {
  activityDiagram,
  activityDiagramByCtx,
} from '@meta2d/activity-diagram';
import { classPens } from '@meta2d/class-diagram';
import { sequencePens, sequencePensbyCtx } from '@meta2d/sequence-diagram';
import { register as registerEcharts } from '@meta2d/chart-diagram';
import { formPens } from '@meta2d/form-diagram';
import { chartsPens } from '@meta2d/le5le-charts';
import { ftaPens, ftaPensbyCtx, ftaAnchors } from '@meta2d/fta-diagram';

import { useSelection } from '@/services/selections';

const { select } = useSelection();

const meta2dOptions: any = {
  rule: true,
};

onMounted(() => {
  // 创建实例
  new Meta2d('meta2d', meta2dOptions);

  // 按需注册图形库
  // 以下为自带基础图形库
  register(flowPens());
  registerAnchors(flowAnchors());
  register(activityDiagram());
  registerCanvasDraw(activityDiagramByCtx());
  register(classPens());
  register(sequencePens());
  registerCanvasDraw(sequencePensbyCtx());
  registerEcharts();
  registerCanvasDraw(formPens());
  registerCanvasDraw(chartsPens());
  register(ftaPens());
  registerCanvasDraw(ftaPensbyCtx());
  registerAnchors(ftaAnchors());

  // 注册其他自定义图形库
  // ...

  // 读取本地存储
  let data: any = localStorage.getItem('meta2d');
  if (data) {
    data = JSON.parse(data);

    // 判断是否为运行查看，是-设置为预览模式
    if (location.pathname === '/preview') {
      data.locked = 1;
    } else {
      data.locked = 0;
    }
    meta2d.open(data);
  }

  meta2d.on('active', active);
  meta2d.on('inactive', inactive);
});

const active = (pens?: Pen[]) => {
  select(pens);
};

const inactive = () => {
  select();
};

onUnmounted(() => {
  meta2d.destroy();
});
</script>
<style lang="postcss" scoped>
#meta2d {
  height: calc(100vh - 80px);
  z-index: 1;
}
</style>
