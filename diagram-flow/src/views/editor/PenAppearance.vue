<template>
  <div class="form-item mt-12">
    <label class="title" style="width: auto">{{ $t('名称') }}</label>
    <t-input v-model="pen.name" />
  </div>
  <t-divider class="mt-12" />
  <div class="form-item base mt-12">
    <t-input-number label="X" theme="normal" min="0" :autoWidth="false" v-model="pen.x" @change="changeValue('x')" />
    <t-input-number
      class="ml-8"
      label="Y"
      theme="normal"
      min="0"
      :autoWidth="false"
      v-model="pen.y"
      @change="changeValue('y')"
    />
    <t-input-number
      class="ml-8"
      theme="normal"
      min="0"
      :autoWidth="false"
      :placeholder="$t('旋转')"
      v-model="pen.rotate"
      @change="changeValue('rotate')"
    >
      <template #prefix-icon>
        <RotateIcon />
      </template>
    </t-input-number>
  </div>
  <div class="form-item base mt-12 mb-20">
    <t-input-number
      label="W"
      theme="normal"
      min="0"
      :autoWidth="false"
      v-model="pen.width"
      @change="changeValue('width')"
    />
    <t-input-number
      class="ml-8"
      label="H"
      theme="normal"
      min="0"
      :autoWidth="false"
      v-model="pen.height"
      @change="changeValue('height')"
    />
    <t-input-number
      class="ml-8"
      theme="normal"
      min="0"
      :autoWidth="false"
      :placeholder="$t('圆角')"
      v-model="pen.borderRadius"
      @change="changeValue('borderRadius')"
    >
      <template #prefix-icon>
        <ConstraintIcon />
      </template>
    </t-input-number>
  </div>

  <t-divider style="margin: 16px -16px; width: 120%" />

  <t-collapse defaultExpandAll>
    <t-collapse-panel value="0" :header="$t('外观')">
      <AppearancePanel v-model="pen" @change="changeValue" />
    </t-collapse-panel>

    <t-divider style="margin: 0 -16px; width: 120%" />

    <t-collapse-panel class="mt-16" value="1" :header="$t('文字')">
      <TextPanel v-model="pen" @change="changeValue" />
    </t-collapse-panel>

    <t-divider style="margin: 0 -16px; width: 120%" />

    <t-collapse-panel class="mt-16" value="2" :header="$t('其他')">
      <OtherPanel v-model="pen" @change="changeValue" />
    </t-collapse-panel>
  </t-collapse>
</template>
<script lang="ts" setup>
import { onMounted, toRaw, toRefs } from 'vue';
import { ConstraintIcon, RotateIcon } from 'tdesign-icons-vue-next';
import { Meta2d, Mode } from '@meta2d/core';

import { useSelection } from './services/selections';
import AppearancePanel from './components/AppearancePanel.vue';
import TextPanel from './components/TextPanel.vue';
import OtherPanel from './components/OtherPanel.vue';

const { selections } = useSelection();

const { pen } = toRefs(selections) as any;

let meta2d: Meta2d;

onMounted(async () => {
  meta2d = document.querySelector('le5le-meta2d') as Meta2d;
});

const changeValue = (key: string) => {
  if (!pen.value) {
    return;
  }
  const val = toRaw(pen.value);
  meta2d.setValue({ id: val.id, [key]: val[key] }, { mode: Mode.Edit });

  // 文字、线宽等引起包围盒大小变化时，重新调整活动框
  // 延迟20ms是等待画布后台线程文字区域更新
  setTimeout(() => {
    meta2d.active();
  }, 20);
};
</script>
<style lang="postcss" scoped>
:deep(.t-collapse-panel__wrapper) {
  .t-collapse-panel__header {
    padding: 0;
  }
}
</style>
