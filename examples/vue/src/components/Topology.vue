<!--
 * @Description: 
 * @Author: G
 * @Date: 2021-10-13 11:10:11
 * @LastEditTime: 2021-10-13 14:05:59
-->
<script setup lang="ts">
import { onMounted, ref } from "vue";
// 测试本地使用
// import { Topology } from "../../../../packages/core";
import { register as registerEcharts } from "@topology/chart-diagram";
import { Pen, Topology } from "@topology/core";

onMounted(() => {
  const topology = new Topology("topology");
  registerEcharts();

  // 监听消息
  topology.on("showDialog", ({ pen }: { pen: Pen }) => {
    currentPen.value = pen;

    // vue 打开弹窗
    visible.value = true;
  });
  (window as any).mainTopology = (window as any).topology;
});

const visible = ref(false);
const currentPen = ref<Pen>({});
</script>

<template>
  <div class="main">
    <div class="topology" id="topology"></div>
  </div>

  <a-modal v-model:visible="visible" :title="currentPen.text">
    <p>{{ currentPen.name }}</p>
    <p>{{ currentPen.text }}</p>
  </a-modal>
</template>

<style scoped></style>