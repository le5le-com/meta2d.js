<!--
 * @Description: 
 * @Author: G
 * @Date: 2021-10-13 11:10:11
 * @LastEditTime: 2021-10-13 14:05:59
-->
<script setup lang="ts">
import { onMounted } from "vue";
// 测试本地使用
// import { Topology } from "../../../../packages/core";
import { register as registerEcharts } from "@topology/chart-diagram";
import { Topology } from "@topology/core";

onMounted(() => {
  new Topology("topology");
  registerEcharts();
});
</script>

<template>
  <div class="main">
    <div class="topology" id="topology"></div>
  </div>
</template>

<style scoped></style>
