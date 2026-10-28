<template>
  <div>
    <div class="form-item mt-12">
      <div class="flex middle">
        <t-select
          creatable
          filterable
          style="width: 100px"
          :placeholder="$t('字体名')"
          :options="fontOptions"
          v-model="textConfig.fontFamily"
          @change="emit('change', 'fontFamily')"
        />
        <t-tooltip :content="$t('字体大小')" placement="top">
          <t-input-number
            class="ml-4"
            theme="normal"
            :placeholder="$t('大小')"
            style="width: 50px"
            v-model="textConfig.fontSize"
            :format="(value) => `${value}px`"
            @change="emit('change', 'fontSize')"
          />
        </t-tooltip>
        <t-tooltip :content="$t('行高')" placement="top">
          <t-input-number
            class="ml-4"
            theme="normal"
            :placeholder="$t('行高')"
            style="width: 50px"
            v-model="textConfig.lineHeight"
            @change="emit('change', 'lineHeight')"
          />
        </t-tooltip>
        <t-tooltip :content="$t('字间距')" placement="top">
          <t-input-number
            class="ml-4"
            theme="normal"
            :placeholder="$t('间距')"
            style="width: 50px"
            v-model="textConfig.letterSpacing"
            :format="(value) => `${value}px`"
            @change="emit('change', 'letterSpacing')"
          />
        </t-tooltip>
      </div>
    </div>
    <div class="flex middle mt-12">
      <t-radio-group size="small" v-model="textConfig.textAlign" @change="emit('change', 'textAlign')">
        <t-radio-button :value="1">
          <t-tooltip :content="$t('居左')" placement="top">
            <format-vertical-align-left-icon />
          </t-tooltip>
        </t-radio-button>
        <t-radio-button :value="2">
          <t-tooltip placement="top" :content="$t('水平居中')">
            <format-vertical-align-center-icon />
          </t-tooltip>
        </t-radio-button>
        <t-radio-button :value="3">
          <t-tooltip placement="top" :content="$t('居右')">
            <format-vertical-align-right-icon />
          </t-tooltip>
        </t-radio-button>
      </t-radio-group>
      <t-radio-group
        class="ml-12"
        size="small"
        v-model="textConfig.textVertical"
        @change="emit('change', 'textVertical')"
      >
        <t-radio-button :value="1">
          <t-tooltip placement="top" :content="$t('顶部对齐')">
            <format-horizontal-align-top-icon />
          </t-tooltip>
        </t-radio-button>
        <t-radio-button :value="2">
          <t-tooltip placement="top" :content="$t('垂直居中')">
            <format-horizontal-align-center-icon />
          </t-tooltip>
        </t-radio-button>
        <t-radio-button :value="3">
          <t-tooltip placement="top" :content="$t('底部对齐')">
            <format-horizontal-align-bottom-icon />
          </t-tooltip>
        </t-radio-button>
      </t-radio-group>
      <t-button class="ml-12 icon" theme="default" shape="rectangle" :variant="fontWeight" @click="changeFontWeight">
        B
      </t-button>
      <t-button
        class="ml-4 icon"
        theme="default"
        shape="rectangle"
        :variant="fontItalic"
        @click="changeFontItalic"
        style="font-style: italic; font-family: serif"
      >
        I
      </t-button>
    </div>
    <div class="form-item mt-12">
      <label>{{ $t('颜色') }}</label>
      <div class="w-full">
        <t-select v-model="textColorType">
          <t-option :key="0" :value="0" :label="$t('纯色')"></t-option>
          <t-option :key="1" :value="1" :label="$t('线性渐变')"></t-option>
          <t-option :key="2" :value="2" :label="$t('径向渐变')"></t-option>
        </t-select>
        <t-color-picker
          v-if="textColorType === 0"
          class="w-full mt-12"
          format="CSS"
          :swatch-colors="presetPalettes"
          :color-modes="['monochrome']"
          :recent-colors="null"
          :enable-alpha="true"
          :show-primary-color-preview="false"
          clearable
          v-model="textConfig.textColor"
          @change="emit('change', 'textColor')"
        />
        <t-color-picker
          v-else-if="textColorType === 1"
          class="w-full mt-12"
          format="CSS"
          :enable-alpha="true"
          :recent-colors="null"
          :swatch-colors="presetPalettes"
          :color-modes="['linear-gradient']"
          :show-primary-color-preview="false"
          clearable
          v-model="textGradientColor"
          @change="emit('change', 'textGradient')"
        />
        <div class="w-full" v-else-if="textColorType === 2">
          <t-color-picker
            class="w-full mt-12"
            format="CSS"
            :enable-alpha="true"
            :recent-colors="null"
            :swatch-colors="presetPalettes"
            :color-modes="['linear-gradient']"
            :show-primary-color-preview="false"
            clearable
            v-model="textGradientColor"
            @change="emit('change', 'textGradient')"
          />
          <div class="flex middle mt-12">
            <t-input-number
              class="flex-grow mr-4"
              theme="normal"
              :placeholder="$t('内圆半径')"
              :min="0"
              :max="1"
              :step="0.1"
              v-model="textGradientRadius1"
              @change="emit('change', 'textGradient')"
            />
            <t-input-number
              class="flex-grow ml-4"
              theme="normal"
              :placeholder="$t('外圆半径')"
              :min="0"
              :max="1"
              :step="0.1"
              v-model="textGradientRadius2"
              @change="emit('change', 'textGradient')"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="form-item mt-12">
      <label>{{ $t('悬停') }}</label>
      <t-color-picker
        class="w-full"
        format="CSS"
        :enable-alpha="true"
        :recent-colors="null"
        :swatch-colors="presetPalettes"
        :color-modes="['monochrome']"
        :show-primary-color-preview="false"
        clearable
        v-model="textConfig.textHoverColor"
        @change="emit('change', 'textHoverColor')"
      ></t-color-picker>
    </div>
    <div class="form-item mt-12">
      <label>{{ $t('选中') }}</label>
      <t-color-picker
        class="w-full"
        format="CSS"
        :enable-alpha="true"
        :recent-colors="null"
        :swatch-colors="presetPalettes"
        :color-modes="['monochrome']"
        :show-primary-color-preview="false"
        clearable
        v-model="textConfig.textActiveColor"
        @change="emit('change', 'textActiveColor')"
      ></t-color-picker>
    </div>
    <div class="form-item mt-12">
      <label>{{ $t('背景') }}</label>
      <t-color-picker
        class="w-full"
        format="CSS"
        :enable-alpha="true"
        :recent-colors="null"
        :swatch-colors="presetPalettes"
        :color-modes="['monochrome']"
        :show-primary-color-preview="false"
        clearable
        v-model="textConfig.textBackground"
        @change="emit('change', 'textBackground')"
      />
    </div>

    <t-divider class="mt-16" />

    <div class="form-item mt-16">
      <t-tooltip :content="$t('水平偏移')">
        <t-input-number
          theme="normal"
          placeholder="X"
          style="width: 61px"
          v-model="textConfig.textLeft"
          @change="emit('change', 'textLeft')"
        ></t-input-number>
      </t-tooltip>
      <t-tooltip :content="$t('垂直偏移')">
        <t-input-number
          theme="normal"
          class="ml-4"
          placeholder="Y"
          style="width: 61px"
          v-model="textConfig.textTop"
          @change="emit('change', 'textTop')"
        ></t-input-number>
      </t-tooltip>
      <t-tooltip :content="$t('宽')">
        <t-input-number
          theme="normal"
          class="ml-4"
          style="width: 61px"
          v-model="textConfig.textWidth"
          :placeholder="$t('宽')"
          @change="emit('change', 'textWidth')"
        ></t-input-number>
      </t-tooltip>
      <t-tooltip :content="$t('高')">
        <t-input-number
          theme="normal"
          class="ml-4"
          style="width: 61px"
          v-model="textConfig.textHeight"
          :placeholder="$t('高')"
          @change="emit('change', 'textHeight')"
        ></t-input-number>
      </t-tooltip>
    </div>

    <div class="form-item mt-12">
      <label>{{ $t('小数位数') }}</label>
      <t-input-number
        theme="normal"
        :placeholder="$t('保留小数位数')"
        v-model="textConfig.keepDecimal"
        @change="emit('change', 'keepDecimal')"
      />
    </div>
    <div class="form-item mt-12">
      <label>{{ $t('换行') }}</label>
      <t-select v-model="textConfig.textWrap" :placeholder="$t('汉字/单词换行')" @change="emit('change', 'textWrap')">
        <t-option :key="0" :value="0" :label="$t('汉字/单词换行')"></t-option>
        <t-option :key="1" :value="1" :label="$t('换行符换行')"></t-option>
        <t-option :key="2" :value="2" :label="$t('不换行')"></t-option>
      </t-select>
    </div>
    <div class="form-item mt-12">
      <label>{{ $t('显示省略号') }}</label>
      <t-checkbox v-model="textConfig.ellipsis" @change="emit('change', 'ellipsis')"> </t-checkbox>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { presetPalettes, fonts } from '../services/const';
import {
  FormatVerticalAlignLeftIcon,
  FormatVerticalAlignCenterIcon,
  FormatVerticalAlignRightIcon,
  FormatHorizontalAlignBottomIcon,
  FormatHorizontalAlignCenterIcon,
  FormatHorizontalAlignTopIcon,
} from 'tdesign-icons-vue-next';
import { canvasLinerGradientToCss, canvasRadialGradientToCss, ColorType } from '@meta2d/core';
import { cssToCanvasLinerGradient, cssToCanvasRadialGradient } from '../../../services/color';

interface TextConfig {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: number;
  textVertical?: number;
  fontWeight?: string | number;
  fontStyle?: string;
  textColor?: string;
  textGradient?: any;
  textHoverColor?: string;
  textActiveColor?: string;
  textBackground?: string;
  textLeft?: number;
  textTop?: number;
  textWidth?: number;
  textHeight?: number;
  keepDecimal?: number;
  textWrap?: number;
  ellipsis?: boolean;
}

const textConfig = defineModel<TextConfig>({ required: true });

const emit = defineEmits<{
  change: [key: string, value?: any];
}>();

const fontOptions = ref<any[]>([]);

const fontWeight = computed(() => {
  if (
    !textConfig.value ||
    !textConfig.value.fontWeight ||
    textConfig.value.fontWeight === 'normal' ||
    (typeof textConfig.value.fontWeight === 'number' && textConfig.value.fontWeight < 700)
  ) {
    return 'text';
  }

  return 'base';
});

const fontItalic = computed(() => {
  if (!textConfig.value.fontStyle || textConfig.value.fontStyle !== 'normal') {
    return 'text';
  }
  return 'base';
});

const textColorType = computed({
  get() {
    return textConfig.value.textGradient?.type || ColorType.Color;
  },
  set(newValue: ColorType) {
    if (newValue === ColorType.Color) {
      textConfig.value.textGradient = undefined;
      emit('change', 'textGradient');
      return;
    }

    // 渐变色时，清除纯色
    textConfig.value.textColor = undefined;
    textConfig.value.textGradient = { type: newValue };
    emit('change', 'textColor');
  },
});

const textGradientColor = computed({
  get() {
    if (!textConfig.value.textGradient) {
      return '';
    }
    if (textConfig.value.textGradient.type === ColorType.LinearGradient) {
      return canvasLinerGradientToCss(textConfig.value.textGradient);
    }
    return canvasRadialGradientToCss(textConfig.value.textGradient);
  },
  set(newValue: string) {
    if (!newValue) {
      textConfig.value.textGradient = null;
      return;
    }

    if (textColorType.value === ColorType.LinearGradient) {
      textConfig.value.textGradient = cssToCanvasLinerGradient(newValue);
      return;
    }

    textConfig.value.textGradient = cssToCanvasRadialGradient(newValue);
    if (textConfig.value.textGradient.r0 == undefined) textConfig.value.textGradient.r0 = 0;
    if (textConfig.value.textGradient.r1 == undefined) textConfig.value.textGradient.r1 = 1;
  },
});

const textGradientRadius1 = computed({
  get() {
    return textConfig.value.textGradient?.r0 ?? 0;
  },
  set(newValue: number) {
    if (textConfig.value.textGradient) {
      textConfig.value.textGradient.r0 = newValue ?? 0;
    }
  },
});

const textGradientRadius2 = computed({
  get() {
    return textConfig.value.textGradient?.r1 ?? 0;
  },
  set(newValue: number) {
    if (textConfig.value.textGradient) {
      textConfig.value.textGradient.r1 = newValue ?? 0;
    }
  },
});

onMounted(async () => {
  for (const item of fonts) {
    fontOptions.value.push({ label: item, value: item });
  }
});

function changeFontWeight() {
  const currentWeight = textConfig.value.fontWeight;
  textConfig.value.fontWeight =
    !currentWeight || currentWeight === 'normal' || (typeof currentWeight === 'number' && currentWeight < 700)
      ? 'bold'
      : 'normal';
  emit('change', 'fontWeight');
}

function changeFontItalic() {
  const currentStyle = textConfig.value.fontStyle;
  textConfig.value.fontStyle = !currentStyle || currentStyle === 'normal' ? 'italic' : 'normal';
  emit('change', 'fontStyle');
}
</script>
