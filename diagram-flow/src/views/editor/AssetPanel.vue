<template>
  <div class="assets-panel">
    <div class="search-input">
      <t-input ref="searchInputRef" :placeholder="$t('搜索图形')" clearable v-model="keyWord">
        <template #suffixIcon>
          <search-icon :style="{ cursor: 'pointer' }" />
        </template>
      </t-input>
    </div>
    <t-tabs v-model="tab">
      <t-tab-panel :value="1" :label="$t('图形库')">
        <Graphics :keyWord="keyWord" />
      </t-tab-panel>
      <t-tab-panel :value="2" :label="$t('图层')">
        <Layer :keyWord="keyWord" />
      </t-tab-panel>
    </t-tabs>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { SearchIcon } from 'tdesign-icons-vue-next';
import Layer from './Layer.vue';
import Graphics from './Graphics.vue';
import { emitter } from './services/emitter';
const tab = ref(1);
const keyWord = ref('');
onMounted(() => {
  emitter.on('searchInputFocus', searchInputFocus);
});
onUnmounted(() => {
  emitter.off('searchInputFocus', searchInputFocus);
});

const searchInputRef = ref<HTMLInputElement | null>(null);
const searchInputFocus = () => {
  searchInputRef.value?.focus();
};
</script>
<style lang="postcss" scoped>
.assets-panel {
  width: 100%;
  height: 100%;
  overflow: hidden;
  .search-input {
    margin-top: 16px;
    margin-bottom: 8px;
    padding-inline: 12px;
  }
  :deep(.t-tabs) {
    height: calc(100% - 42px);
    .t-tabs__content {
      height: calc(100% - 40px);
    }
    .t-tab-panel {
      height: 100%;
    }
  }
}
</style>
