<template>
  <div class="app-page">
    <Header />

    <div class="designer">
      <Graphics />
      <View />
      <Props />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';

import Header from '../components/Header.vue';
import Graphics from '../components/Graphics.vue';
import View from '../components/View.vue';
import Props from '../components/Props.vue';

let timer: any;
function save() {
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => {
    const data: any = meta2d.data();
    localStorage.setItem('meta2d', JSON.stringify(data));
    timer = undefined;
  }, 1000);
}

onMounted(() => {
  meta2d.on('scale', save);
  meta2d.on('add', save);
  meta2d.on('opened', save);
  meta2d.on('undo', save);
  meta2d.on('redo', save);
  meta2d.on('add', save);
  meta2d.on('delete', save);
  meta2d.on('rotatePens', save);
  meta2d.on('translatePens', save);
});
</script>

<style lang="postcss" scoped>
.app-page {
  height: 100vh;
  overflow: hidden;

  .designer {
    display: grid;
    grid-template-columns: 300px 1fr 301px;
    height: calc(100vh - 80px);
  }
}
</style>
