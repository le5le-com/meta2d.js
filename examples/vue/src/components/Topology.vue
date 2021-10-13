<!--
 * @Description: 
 * @Author: G
 * @Date: 2021-10-13 11:10:11
 * @LastEditTime: 2021-10-13 14:05:59
-->
<script setup lang="ts">
import { onMounted } from 'vue';
import '../../../../dist/topology/topology';

onMounted(() => {
  window.topology = new window.Topology('topology');
});
</script>

<template>
<div class='main' >
  <div class="topology" id="topology"></div>
</div>
</template>

<style scoped>

</style>
