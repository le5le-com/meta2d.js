<template>
  <t-tabs v-model="tab" class="props">
    <t-tab-panel :value="1" :label="$t('外观')" class="panel">
      <PenAppearance />
    </t-tab-panel>
    <t-tab-panel :value="2" :label="$t('动画')">
      <PenAnimates />
    </t-tab-panel>
    <t-tab-panel :value="3" :label="$t('交互')">
      <PenEvents />
    </t-tab-panel>
  </t-tabs>
</template>
<script lang="ts" setup>
import { ref } from 'vue';
import PenAnimates from './PenAnimates.vue';

import PenAppearance from './PenAppearance.vue';
import PenEvents from './PenEvents.vue';

const tab = ref(1);
</script>
<style lang="postcss" scoped></style>
