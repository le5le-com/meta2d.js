<!--
 * @Description:
 * @Author: G
 * @Date: 2021-10-13 11:09:59
 * @LastEditTime: 2021-10-13 14:26:48
-->
<script setup lang="ts">
declare const window: Window;

import { nextTick } from "vue";
import { icons } from "../utils/data";
const onDragStart = (e: any, data) => {
  e.dataTransfer.setData("Topology", JSON.stringify(data));
};

nextTick(() => {
  // 此处只注册，未将数据放置到工具栏
  // data.ts 中配置的最后一项即为该图形库中的内容
  (window as any).registerToolsNew();
  (window as any).topologyTools = undefined;
});
</script>

<template>
  <div class="aside">
    <div class="icon-list">
      <div v-for="icon in icons" :key="icon.key">
        <i
          draggable="true"
          class="iconfont"
          :class="`icon-${icon.key}`"
          :title="icon.title"
          @dragstart="onDragStart($event, icon.data)"
        ></i>
      </div>
    </div>
    <div class="link">
      <a href="http://topology.le5le.com/workspace/">去官网</a>
    </div>
  </div>
</template>

<style scoped></style>
