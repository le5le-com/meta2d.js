<template>
  <t-tabs v-model="tab" class="props">
    <t-tab-panel :value="1" :label="$t('画布')" class="panel">
      <div class="title">{{ $t('大小') }}</div>
      <t-select class="mt-8" :value="pageSize" @change="selectPage">
        <t-option v-for="item in pageList" :key="item.name" :value="item.name" :label="item.name" />
      </t-select>
      <div class="flex middle mt-12" v-if="pageSize !== '默认 (自动扩展)'">
        <t-input-number
          label="W"
          v-model="data.width"
          :placeholder="$t('宽')"
          theme="normal"
          min="1"
          style="width: 115px"
          @change="changeValue('width')"
        />
        <ArrowLeftRight1Icon class="hover ml-12 mr-4" @click="swapPageSize" />
        <t-input-number
          class="ml-8"
          label="H"
          :placeholder="$t('高')"
          theme="normal"
          min="1"
          v-model="data.height"
          style="width: 115px"
          @change="changeValue('height')"
        />
      </div>

      <t-divider style="margin: 16px -16px; width: 120%" />

      <div class="title">{{ $t('背景') }}</div>

      <div class="form-item mt-12">
        <label>{{ $t('背景颜色') }}</label>
        <t-color-picker
          class="w-full"
          format="CSS"
          :recent-colors="null"
          :enable-alpha="true"
          :swatch-colors="presetPalettes"
          :color-modes="['monochrome']"
          :show-primary-color-preview="false"
          v-model="data.background"
          @change="changeValue('background')"
        />
      </div>
      <t-divider style="margin: 16px -16px; width: 120%" />

      <div class="form-item mt-8">
        <label class="title">{{ $t('网格') }}</label>
        <t-checkbox v-model="data.grid.enable" @change="changeValue('grid')"></t-checkbox>
      </div>
      <div class="form-item mt-12">
        <label>{{ $t('网格大小') }}</label>
        <t-input-number
          v-model="data.grid.size"
          :placeholder="$t('宽')"
          theme="normal"
          min="0"
          :decimalPlaces="0"
          :disabled="!data.grid.enable"
          @change="changeValue('grid')"
        />
      </div>
      <div class="form-item mt-12">
        <label>{{ $t('网格角度') }}</label>
        <t-input-number
          v-model="data.grid.rotate"
          :placeholder="$t('宽')"
          theme="normal"
          min="0"
          :decimalPlaces="0"
          :disabled="!data.grid.enable"
          @change="changeValue('grid')"
        />
      </div>
      <div class="form-item mt-12">
        <label>{{ $t('网格颜色') }}</label>
        <t-color-picker
          class="w-full"
          format="CSS"
          :recent-colors="null"
          :enable-alpha="true"
          :swatch-colors="presetPalettes"
          :color-modes="['monochrome']"
          :show-primary-color-preview="false"
          v-model="data.grid.color"
          :disabled="!data.grid.enable"
          @change="changeValue('grid')"
        />
      </div>

      <t-divider style="margin: 16px -16px; width: 120%" />

      <div class="form-item mt-8">
        <label class="title">{{ $t('标尺') }}</label>
        <t-checkbox v-model="data.rule.enable" @change="changeValue('rule')" />
      </div>
      <div class="form-item mt-12">
        <label>{{ $t('标尺风格') }}</label>
        <t-radio-group v-model="data.rule.style" :disabled="!data.rule.enable" @change="changeValue('rule')">
          <t-radio :value="0" label="0">{{ $t('简约风格') }}</t-radio>
          <t-radio :value="1" label="1">{{ $t('条形尺风格') }}</t-radio>
        </t-radio-group>
      </div>
      <div class="form-item mt-12">
        <label>{{ $t('标尺颜色') }}</label>
        <t-color-picker
          class="w-full"
          format="CSS"
          :recent-colors="null"
          :enable-alpha="true"
          :swatch-colors="presetPalettes"
          :color-modes="['monochrome']"
          :show-primary-color-preview="false"
          :disabled="!data.rule.enable"
          v-model="data.rule.color"
          @change="changeValue('rule')"
        />
      </div>
      <div class="form-item mt-12">
        <label>{{ $t('背景颜色') }}</label>
        <t-color-picker
          class="w-full"
          format="CSS"
          :recent-colors="null"
          :enable-alpha="true"
          :swatch-colors="presetPalettes"
          :color-modes="['monochrome']"
          :show-primary-color-preview="false"
          :disabled="!data.rule.enable"
          v-model="data.rule.background"
          @change="changeValue('rule')"
        />
      </div>
      <div class="form-item mt-12">
        <label>{{ $t('文字颜色') }}</label>
        <t-color-picker
          class="w-full"
          format="CSS"
          :recent-colors="null"
          :enable-alpha="true"
          :swatch-colors="presetPalettes"
          :color-modes="['monochrome']"
          :show-primary-color-preview="false"
          :disabled="!data.rule.enable"
          v-model="data.rule.textColor"
          @change="changeValue('rule')"
        />
      </div>
    </t-tab-panel>
    <t-tab-panel :value="2" :label="$t('样式')" class="panel">
      <div class="grid">
        <div class="icon" v-for="item in defalutStyles" :key="item.icon" @click="changeStyle(item.value)">
          <img :src="`/styles/${item.icon}.png`" class="icon-style" />
        </div>
      </div>
    </t-tab-panel>
  </t-tabs>
</template>

<script lang="ts" setup>
import { onMounted, ref, toRaw } from 'vue';

import { ArrowLeftRight1Icon } from 'tdesign-icons-vue-next';

import { presetPalettes, defalutStyles } from './services/const';
import { Meta2d } from '@meta2d/core';
import { emitter } from './services/emitter';
// 定义图标数据 - 修改为统一的字符串数组

const tab = ref(1);

const data = ref<any>({
  grid: {
    enable: false,
    size: 20,
    rotate: 0,
    color: '',
  },
  rule: {
    enable: true,
    style: 0,
    color: '',
    background: '',
    textColor: '',
  },
});
const pageSize = ref('默认 (自动扩展)');
const pageList = [
  {
    name: '默认 (自动扩展)',
  },
  {
    name: 'A3 (1500px * 2100px)',
    width: 1500,
    height: 2100,
  },
  {
    name: 'A4 (1050px * 1500px)',
    width: 1050,
    height: 1500,
  },
  {
    name: 'A5 (750px * 1050px)',
    width: 750,
    height: 1050,
  },
  {
    name: '自定义',
  },
];
let meta2d: Meta2d;

onMounted(async () => {
  const timer = setInterval(() => {
    meta2d = document.querySelector('le5le-meta2d') as Meta2d;
    if (meta2d) {
      clearInterval(timer);
      megerData(meta2d.getData());
    }
  }, 50);
  emitter.on('open', (meta2dData: any) => {
    megerData(meta2dData);
  });
});

const megerData = (meta2dData: any) => {
  Object.assign(data.value, { pens: [] }, meta2dData);
  if (!meta2dData.width) {
    pageSize.value = '默认 (自动扩展)';
    return;
  }

  if (
    (meta2dData.width === 1500 && meta2dData.height === 2100) ||
    (meta2dData.width === 2100 && meta2dData.height === 1500)
  ) {
    pageSize.value = 'A3 (1500px * 2100px)';
    return;
  }

  if (
    (meta2dData.width === 1050 && meta2dData.height === 1500) ||
    (meta2dData.width === 1500 && meta2dData.height === 1050)
  ) {
    pageSize.value = 'A4 (1050px * 1500px)';
    return;
  }

  if (
    (meta2dData.width === 750 && meta2dData.height === 1050) ||
    (meta2dData.width === 1050 && meta2dData.height === 750)
  ) {
    pageSize.value = 'A5 (750px * 1050px)';
    return;
  }

  pageSize.value = '自定义';
};

const selectPage = (v: any) => {
  pageSize.value = v;

  const val = pageList.find((item) => item.name === v);
  if (val) {
    data.value.width = val.width;
    data.value.height = val.height;
    meta2d.setPageConfig({ width: val.width, height: val.height });
  }
};

const swapPageSize = () => {
  const w = data.value.width;
  data.value.width = data.value.height;
  data.value.height = w;
  meta2d.setPageConfig({ width: data.value.width, height: data.value.height });
};
const changeValue = (v: string) => {
  const rawData = toRaw(data.value);
  meta2d.setPageConfig({ [v]: rawData[v] });
};
const changeStyle = (v: any) => {
  // const pens = meta2d.getData().pens;
  // pens.forEach((item) => {
  //   meta2d.setValue({ id: item.id, style: v });
  // });
};
</script>
<style lang="postcss" scoped>
.grid {
  grid-template-columns: repeat(3, 1fr);
  .icon {
    padding: 8px 12px;
    border-radius: 4px;
    &:hover {
      background-color: #dbdbdb;
    }
  }
}
</style>
