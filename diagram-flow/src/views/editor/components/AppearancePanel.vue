<template>
  <div>
    <div class="form-item mt-12">
      <label for="color">{{ $t('颜色') }}</label>
      <t-color-picker
        class="w-full"
        format="CSS"
        :recent-colors="null"
        :enable-alpha="true"
        :swatch-colors="presetPalettes"
        :color-modes="['monochrome']"
        :show-primary-color-preview="false"
        :inputProps="{
          autoWidth: false,
        }"
        clearable
        v-model="appearance.color"
        @change="emit('change', 'color')"
      />
    </div>
    <div class="form-item mt-12">
      <label for="hover-color">{{ $t('悬停颜色') }}</label>
      <t-color-picker
        format="CSS"
        class="w-full"
        :recent-colors="null"
        :enable-alpha="true"
        :swatch-colors="presetPalettes"
        :color-modes="['monochrome']"
        :show-primary-color-preview="false"
        :inputProps="{
          autoWidth: false,
        }"
        clearable
        v-model="appearance.hoverColor"
        @change="emit('change', 'hoverColor')"
      />
    </div>
    <div class="form-item mt-12">
      <label for="selected-color">{{ $t('选中颜色') }}</label>
      <t-color-picker
        format="CSS"
        class="w-full"
        :recent-colors="null"
        :enable-alpha="true"
        :swatch-colors="presetPalettes"
        :color-modes="['monochrome']"
        :show-primary-color-preview="false"
        :inputProps="{
          autoWidth: false,
        }"
        clearable
        v-model="appearance.activeColor"
        @change="emit('change', 'activeColor')"
      />
    </div>
    <div class="form-item mt-12">
      <label>{{ $t('背景') }}</label>
      <div class="w-full">
        <t-select v-model="backgroundType" @change="emit('change', 'backgrounds')">
          <t-option :key="0" :value="0" :label="$t('纯色')"></t-option>
          <t-option :key="1" :value="1" :label="$t('线性渐变')"></t-option>
          <t-option :key="2" :value="2" :label="$t('径向渐变')"></t-option>
        </t-select>

        <t-color-picker
          v-if="!backgroundType"
          class="w-full mt-12"
          format="CSS"
          :swatch-colors="presetPalettes"
          :color-modes="['monochrome']"
          :recent-colors="null"
          :enable-alpha="true"
          :show-primary-color-preview="false"
          clearable
          v-model="backgroundColor"
          @change="emit('change', 'backgrounds')"
        />
        <t-color-picker
          v-else-if="backgroundType === 1"
          class="w-full mt-12"
          format="CSS"
          :enable-alpha="true"
          :recent-colors="null"
          :color-modes="['linear-gradient']"
          :show-primary-color-preview="false"
          clearable
          v-model="backgroundGradientColor"
          @change="emit('change', 'backgrounds')"
        />
        <div v-else-if="backgroundType === 2" class="mt-12">
          <t-color-picker
            format="CSS"
            :enable-alpha="true"
            :recent-colors="null"
            :color-modes="['linear-gradient']"
            :show-primary-color-preview="false"
            :inputProps="{
              autoWidth: false,
            }"
            clearable
            v-model="backgroundGradientColor"
            @change="emit('change', 'backgrounds')"
          />

          <div class="flex middle mt-12">
            <t-input-number
              class="flex-grow mr-4"
              theme="normal"
              :placeholder="$t('内圆半径')"
              :min="0"
              :max="1"
              :step="0.1"
              v-model="backgroundGradientRadius1"
              @change="emit('change', 'backgrounds')"
            />
            <t-input-number
              class="flex-grow ml-4"
              theme="normal"
              :placeholder="$t('外圆半径')"
              :min="0"
              :max="1"
              :step="0.1"
              v-model="backgroundGradientRadius2"
              @change="emit('change', 'backgrounds')"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="form-item mt-12">
      <label for="">{{ $t('悬停背景') }}</label>
      <t-color-picker
        class="w-full"
        format="CSS"
        :swatch-colors="presetPalettes"
        :color-modes="['monochrome']"
        :recent-colors="null"
        :enable-alpha="true"
        :show-primary-color-preview="false"
        clearable
        v-model="appearance.hoverBackground"
        @change="emit('change', 'hoverBackground')"
      />
    </div>
    <div class="form-item mt-12">
      <label for="">{{ $t('选中背景') }} </label>
      <t-color-picker
        class="w-full"
        format="CSS"
        :swatch-colors="presetPalettes"
        :color-modes="['monochrome']"
        :recent-colors="null"
        :enable-alpha="true"
        :show-primary-color-preview="false"
        clearable
        v-model="appearance.activeBackground"
        @change="emit('change', 'activeBackground')"
      />
    </div>
    <div class="form-item mt-12">
      <label>{{ $t('线条样式') }} </label>
      <t-select :placeholder="$t('线条样式')" v-model="lineDash" @change="emit('change', 'lineDash')">
        <template #valueDisplay="{ value }">
          <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="width: 100%; height: 20px">
            <g fill="none" stroke="var(--color)" stroke-width="1">
              <path v-if="value < 0" d="M0 9 l85 0" />
              <path v-else d="M0 9 l85 0" :stroke-dasharray="appearance.lineDash?.join(' ')" />
            </g>
          </svg>
        </template>
        <t-option :key="-1" :value="-1">
          <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="width: 80px; height: 14px">
            <g fill="none" stroke="var(--color)" stroke-width="1">
              <path d="M0 9 l85 0" />
            </g>
          </svg>
        </t-option>
        <t-option :key="0" :value="0">
          <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="width: 80px; height: 14px">
            <g fill="none" stroke="var(--color)" stroke-width="1">
              <path stroke-dasharray="5 5" d="M0 9 l85 0" />
            </g>
          </svg>
        </t-option>
        <t-option :key="1" :value="1">
          <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="width: 80px; height: 14px">
            <g fill="none" stroke="var(--color)" stroke-width="1">
              <path stroke-dasharray="10 10" d="M0 9 l85 0" />
            </g>
          </svg>
        </t-option>
        <t-option :key="2" :value="2">
          <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="width: 80px; height: 14px">
            <g fill="none" stroke="var(--color)" stroke-width="1">
              <path stroke-dasharray="10 10 2 10" d="M0 9 l85 0" />
            </g>
          </svg>
        </t-option>
      </t-select>
    </div>
    <div class="form-item mt-12">
      <label for="lineWidth">{{ $t('线条宽度') }}</label>
      <t-input-number
        theme="normal"
        :min="0"
        :decimalPlaces="0"
        v-model="appearance.lineWidth"
        @change="emit('change', 'lineWidth')"
      />
    </div>
    <div class="form-item mt-12">
      <label for="lineSmooth">{{ $t('平滑度') }}</label>
      <t-input-number
        theme="normal"
        :placeholder="$t('推荐') + ' 1-3'"
        :min="0"
        :decimalPlaces="0"
        v-model="appearance.lineSmooth"
        @change="emit('change', 'lineSmooth')"
      />
    </div>
    <div class="form-item mt-12">
      <label for="lineGradient">{{ $t('线条渐变') }}</label>
      <div class="flex middle w-full">
        <t-color-picker
          class="w-full"
          format="CSS"
          :color-modes="['linear-gradient']"
          :show-primary-color-preview="false"
          :recent-colors="null"
          :enableAlpha="true"
          :placeholder="$t('无')"
          clearable
          v-model="lineGradient"
          @change="emit('change', 'lineGradient')"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { presetPalettes } from '../services/const';
import { canvasLinerGradientToCss, canvasRadialGradientToCss, BackgroundType, Background } from '@meta2d/core';
import { cssToCanvasLinerGradient, cssToCanvasRadialGradient } from '../../../services/color';
import { findRowIndex } from '../../../services/value';

interface AppearanceData {
  color?: string;
  hoverColor?: string;
  activeColor?: string;
  hoverBackground?: string;
  activeBackground?: string;
  lineWidth?: number;
  lineDash?: number[];
  lineSmooth?: number;
  lineGradient?: any;
  backgrounds?: Background[];
}

const appearance = defineModel<AppearanceData>({ required: true });

const emit = defineEmits<{
  change: [key: string, value?: any];
}>();

const backgroundType = computed({
  get() {
    return appearance.value.backgrounds?.[0]?.type || BackgroundType.Color;
  },
  set(newValue: BackgroundType) {
    appearance.value.backgrounds = [{ type: newValue }];
  },
});

const backgroundColor = computed({
  get() {
    return appearance.value.backgrounds?.[0]?.color || '';
  },
  set(newValue: string) {
    appearance.value.backgrounds = [{ type: BackgroundType.Color, color: newValue }];
  },
});

const backgroundGradientColor = computed({
  get() {
    const background = appearance.value.backgrounds?.[0];
    if (background.type === BackgroundType.Color || !background.gradient) {
      return '';
    }

    if (background.type === BackgroundType.LinearGradient) {
      return canvasLinerGradientToCss(background.gradient);
    }

    return canvasRadialGradientToCss(background.gradient);
  },
  set(newValue: string) {
    if (!newValue) {
      appearance.value.backgrounds = [{ type: BackgroundType.Color }];
      return;
    }

    const background = appearance.value.backgrounds?.[0];
    if (background.type === BackgroundType.LinearGradient) {
      appearance.value.backgrounds = [
        { type: BackgroundType.LinearGradient, gradient: cssToCanvasLinerGradient(newValue) },
      ];
    } else {
      const gradient = cssToCanvasRadialGradient(newValue);
      appearance.value.backgrounds = [{ type: BackgroundType.RadialGradient, gradient: gradient }];

      if (gradient.r0 == undefined) gradient.r0 = 0;
      if (gradient.r1 == undefined) gradient.r1 = 1;
    }
  },
});

const backgroundGradientRadius1 = computed({
  get() {
    return appearance.value.backgrounds?.[0]?.gradient?.r0 ?? 0;
  },
  set(newValue: number) {
    const gradient = appearance.value.backgrounds?.[0]?.gradient;
    if (gradient) {
      gradient.r0 = newValue ?? 0;
    }
  },
});

const backgroundGradientRadius2 = computed({
  get() {
    return appearance.value.backgrounds?.[0]?.gradient?.r1 ?? 0;
  },
  set(newValue: number) {
    const gradient = appearance.value.backgrounds?.[0]?.gradient;
    if (gradient) {
      gradient.r1 = newValue ?? 0;
    }
  },
});

const lineDashOptions = [
  [5, 5],
  [10, 10],
  [10, 10, 2, 10],
];

const lineDash = computed({
  get() {
    if (!appearance.value.lineDash) {
      return -1;
    }
    return findRowIndex(lineDashOptions, appearance.value.lineDash);
  },
  set(newValue: number) {
    appearance.value.lineDash = lineDashOptions[newValue];
  },
});

const lineGradient = computed({
  get() {
    if (!appearance.value.lineGradient) {
      return '';
    }
    return canvasLinerGradientToCss(appearance.value.lineGradient);
  },
  set(newValue: string) {
    if (!newValue) {
      appearance.value.lineGradient = undefined;
    } else {
      appearance.value.lineGradient = cssToCanvasLinerGradient(newValue);
    }
  },
});
</script>
