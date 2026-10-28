<template>
  <div>
    <div class="form-item mt-12">
      <label class="form-title">{{ $t('水平翻转') }} </label>
      <t-checkbox class="mr-16" v-model="otherConfig.flipX" @change="emit('change', 'flipX')"> </t-checkbox>
    </div>
    <div class="form-item mt-12">
      <label class="form-title">{{ $t('垂直翻转') }} </label>
      <t-checkbox class="mr-16" v-model="otherConfig.flipY" @change="emit('change', 'flipY')"> </t-checkbox>
    </div>

    <div class="form-item mt-12">
      <label class="form-title" style="font-weight: 700">{{ $t('进度') }} </label>
      <t-slider
        v-model="otherConfig.progress"
        :min="progressMin"
        :max="progressMax"
        :step="0.1"
        @change="emit('change', 'progress')"
      />
      <span class="ml-16" style="width: 60px; line-height: 30px">
        {{ otherConfig.progress || 0 }}
      </span>
    </div>
    <div class="form-item mt-12">
      <label class="form-title">{{ $t('进度下限') }} </label>
      <t-input-number
        theme="normal"
        class="ml-4"
        v-model="progressMin"
        :placeholder="$t('下限')"
        @change="emit('change', 'progressMin')"
      ></t-input-number>
    </div>
    <div class="form-item mt-12">
      <label class="form-title">{{ $t('进度上限') }} </label>
      <t-input-number
        theme="normal"
        class="ml-4"
        v-model="progressMax"
        :placeholder="$t('上限')"
        @change="emit('change', 'progressMax')"
      ></t-input-number>
    </div>
    <div class="form-item mt-12">
      <label class="form-title">{{ $t('垂直进度') }} </label>
      <t-checkbox class="mr-16" v-model="otherConfig.verticalProgress" @change="emit('change', 'verticalProgress')">
      </t-checkbox>
    </div>
    <div class="form-item mt-12">
      <label class="form-title">{{ $t('反向进度') }} </label>
      <t-checkbox v-model="otherConfig.reverseProgress" @change="emit('change', 'reverseProgress')"> </t-checkbox>
    </div>

    <div class="form-item mt-12">
      <label class="form-title">{{ $t('进度颜色') }} </label>
      <div class="w-full">
        <t-select v-model="progressColorType">
          <t-option :key="0" :value="0" :label="$t('纯色')"></t-option>
          <t-option :key="1" :value="1" :label="$t('线性渐变')"></t-option>
        </t-select>

        <t-color-picker
          v-if="progressColorType === 0"
          class="w-full mt-12"
          format="CSS"
          :swatch-colors="presetPalettes"
          :color-modes="['monochrome']"
          :recent-colors="null"
          :enable-alpha="true"
          :show-primary-color-preview="false"
          clearable
          v-model="progressColor"
          @change="emit('change', 'progressColors')"
        />
        <t-color-picker
          v-else-if="progressColorType === 1"
          class="w-full mt-12"
          format="CSS"
          :enable-alpha="true"
          :recent-colors="null"
          :color-modes="['linear-gradient']"
          :show-primary-color-preview="false"
          clearable
          v-model="progressGradientColor"
          @change="emit('change', 'progressColors')"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { presetPalettes } from '../services/const';
import { canvasLinerGradientToCss, ColorType } from '@meta2d/core';
import { cssToCanvasLinerGradient } from '../../../services/color';

interface OtherData {
  flipX?: boolean;
  flipY?: boolean;
  progress?: number;
  progressMin?: number;
  progressMax?: number;
  verticalProgress?: boolean;
  reverseProgress?: boolean;
  progressColors?: any[];
}

const otherConfig = defineModel<OtherData>({ required: true });

const emit = defineEmits<{
  change: [key: string, value?: any];
}>();

const progressColorType = computed({
  get() {
    const progressColor = otherConfig.value.progressColors?.[0] || { type: ColorType.Color };
    return progressColor.type;
  },
  set(newValue) {
    otherConfig.value.progressColors = [{ type: newValue }];
  },
});

const progressColor = computed({
  get() {
    return otherConfig.value.progressColors?.[0]?.color || '';
  },
  set(newValue) {
    if (!newValue) {
      otherConfig.value.progressColors = [{ type: ColorType.Color }];
      return;
    }
    otherConfig.value.progressColors = [{ type: ColorType.Color, color: newValue }];
  },
});

const progressGradientColor = computed({
  get() {
    const progressColor = otherConfig.value.progressColors?.[0];
    if (!progressColor || !progressColor.gradient) {
      return '';
    }
    return canvasLinerGradientToCss(progressColor.gradient);
  },
  set(newValue: string) {
    if (!newValue) {
      otherConfig.value.progressColors = [{ type: ColorType.LinearGradient }];
      return;
    }
    otherConfig.value.progressColors = [
      { type: ColorType.LinearGradient, gradient: cssToCanvasLinerGradient(newValue) },
    ];
  },
});

const progressMin = computed({
  get() {
    return otherConfig.value.progressMin || 0;
  },
  set(newValue) {
    newValue = newValue || 0;
    if (otherConfig.value.progress < newValue) {
      otherConfig.value.progress = newValue;
    }
    if (newValue > progressMax.value) {
      newValue = progressMax.value - 1;
    }
    otherConfig.value.progressMin = newValue;
  },
});

const progressMax = computed({
  get() {
    return otherConfig.value.progressMax || 1;
  },
  set(newValue) {
    newValue = newValue || 1;
    if (otherConfig.value.progress > newValue) {
      otherConfig.value.progress = newValue;
    }
    if (newValue < progressMin.value) {
      newValue = progressMin.value + 1;
    }
    otherConfig.value.progressMax = newValue;
  },
});
</script>
