<!--
 * @Description:
 * @Author: G
 * @Date: 2021-10-13 11:09:59
 * @LastEditTime: 2021-10-13 14:26:48
-->
<script setup lang="ts">
import { icons } from '../utils/data';
const onDragStart = (e, data) => {
  e.dataTransfer.setData('Topology', JSON.stringify(data));
};
</script>

<template>
  <div class="aside" >
    <div class="icon-list" >
      <div
        v-for="icon in icons"
        :key="icon.key"
      >
        <i
          draggable="true"
          class="iconfont"
          :class="`icon-${ icon.key }`"
          :title="icon.title"
          @dragstart="onDragStart($event, icon.data)"
        ></i>
      </div>
    </div>
    <div class="link" >
      <a href = "http://topology.le5le.com/workspace/">去官网</a>
    </div>
  </div>
</template>

<style scoped>
</style>
