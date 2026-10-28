<template>
  <div class="app-editor" @contextmenu.prevent>
    <Header />
    <div class="editor-body">
      <AssetsPanel />
      <Drawing />
      <FileProps v-if="selections.mode === SelectionMode.File" />
      <PenProps v-else-if="selections.mode === SelectionMode.Pen" />
      <PensProps v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import Header from './Header.vue';
import AssetsPanel from './AssetPanel.vue';
import Drawing from './Drawing.vue';

import FileProps from './FileProps.vue';
import PenProps from './PenProps.vue';
import PensProps from './PensProps.vue';

import { useSelection, SelectionMode } from './services/selections';
import { KeydownFns } from './services/keyEvents';
const keydown = (e: KeyboardEvent) => {
  KeydownFns[e.key] && KeydownFns[e.key](e);
};
onMounted(() => {
  document.addEventListener('keydown', keydown);
});
onUnmounted(() => {
  document.removeEventListener('keydown', keydown);
});
const { selections } = useSelection();
</script>
<style lang="postcss" scoped>
.app-editor {
  width: 100vw;
  height: 100vh;
  background-color: var(--color-background);
  
  .editor-body {
    display: grid;
    grid-template-columns: 300px 1fr 300px;
    height: calc(100% - 40px);
  }
}
</style>
