<template>
  <div class="animations">
    <template v-if="pen.animations?.length">
      <t-collapse :borderless="true" :defaultExpandAll="true" :expand-on-row-click="true">
        <t-collapse-panel v-for="(item, i) in pen.animations" :value="i">
          <template #header>
            <div class="flex middle" @click.stop>
              <t-input
                v-model="item.name"
                :title="item.name"
                :placeholder="$t('请输入')"
                autoWidth
                class="mr-8"
                style="max-width: 80px"
                @change="changeValue"
              />
              <stop-circle-icon v-if="playing === i" class="hover primary" style="font-size: 16px" @click="stop" />
              <play-circle-icon v-else class="hover" style="font-size: 16px" @click="play(Number(i))" />
            </div>
          </template>
          <template #headerRightContent>
            <t-space size="small" @click.stop>
              <t-popconfirm :content="$t('确认删除该动画吗')" placement="left" @confirm="delAnimate(Number(i))">
                <delete-icon class="hover" />
              </t-popconfirm>
            </t-space>
          </template>

          <!-- 连线动画：仅支持水流、水珠、圆点 -->
          <template v-if="pen.category">
            <div class="form-item">
              <label>{{ $t('动画类型') }}</label>
              <t-select v-model="item.lineAnimation.type" @change="changeValue" :placeholder="$t('水流')">
                <t-option
                  v-for="option in lineAnimateList"
                  :key="option.value"
                  :value="option.value"
                  :label="$t(option.label)"
                ></t-option>
              </t-select>
            </div>
            <div v-if="item.lineAnimation.type === 1" class="form-item mt-8">
              <label>{{ $t('线条样式') }}</label>
              <t-select :placeholder="$t('线条样式')" @change="changeLineDash($event, item)">
                <template #valueDisplay>
                  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="width: 100%; height: 20px">
                    <g fill="none" stroke="var(--color)" stroke-width="1">
                      <path d="M0 9 l85 0" :stroke-dasharray="item.lineAnimation.lineDash?.join(' ')" />
                    </g>
                  </svg>
                </template>
                <t-option v-for="(dash, index) in lineDashOptions" :key="index" :value="index">
                  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="width: 80px; height: 14px">
                    <g fill="none" stroke="var(--color)" stroke-width="1">
                      <path :stroke-dasharray="dash.join(' ')" d="M0 9 l85 0" />
                    </g>
                  </svg>
                </t-option>
              </t-select>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('运动速度') }}</label>
              <t-slider
                class="ml-12"
                v-model="item.lineAnimation.span"
                :show-tooltip="true"
                :min="1"
                :max="10"
                @change="changeValue"
              />
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('动画颜色') }}</label>
              <t-color-picker
                class="w-full"
                format="CSS"
                :enable-alpha="true"
                :recent-colors="null"
                :swatch-colors="presetPalettes"
                :color-modes="['monochrome']"
                :show-primary-color-preview="false"
                :clearable="true"
                v-model="item.lineAnimation.color"
                @change="changeValue"
              ></t-color-picker>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('轨迹宽度') }}</label>
              <t-input-number
                v-model="item.lineAnimation.lineWidth"
                theme="column"
                :min="1"
                @change="changeValue"
              ></t-input-number>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('发光效果') }}</label>
              <t-switch class="ml-8 mt-8" size="small" v-model="item.lineAnimation.shadow" @change="changeValue" />
            </div>
            <div v-if="item.lineAnimation.shadow" class="form-item mt-8">
              <label>{{ $t('发光颜色') }}</label>
              <t-color-picker
                class="w-full"
                format="CSS"
                :enable-alpha="true"
                :recent-colors="null"
                :swatch-colors="presetPalettes"
                :color-modes="['monochrome']"
                :show-primary-color-preview="false"
                :clearable="true"
                v-model="item.lineAnimation.shadowColor"
                @change="changeValue"
              ></t-color-picker>
            </div>
            <div v-if="item.lineAnimation.shadow" class="form-item mt-8">
              <label>{{ $t('发光模糊') }}</label>
              <t-input-number
                v-model="item.lineAnimation.shadowBlur"
                theme="column"
                :min="1"
                @change="changeValue"
                :placeholder="$t('默认6')"
              ></t-input-number>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('反向流动') }}</label>
              <t-switch class="ml-8 mt-8" size="small" v-model="item.lineAnimation.reverse" @change="changeValue" />
            </div>
          </template>

          <!-- 节点动画：仅支持闪烁、缩放、旋转 -->
          <template v-else>
            <div class="form-item">
              <label>{{ $t('动画类型') }}</label>
              <t-select v-model="item.animate" :placeholder="$t('动画')" @change="changeAnimate(item)">
                <t-option
                  v-for="option in animateList"
                  :key="option.value"
                  :value="option.value"
                  :label="$t(option.label)"
                ></t-option>
              </t-select>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('结束状态') }}</label>
              <t-select v-model="item.keepAnimationState" @change="changeValue" :placeholder="$t('初始状态')">
                <t-option :key="0" :value="false" :label="$t('初始状态')"></t-option>
                <t-option :key="1" :value="true" :label="$t('当前状态')"></t-option>
              </t-select>
            </div>
          </template>

          <!-- 连线和节点共用 -->
          <div class="form-item mt-8">
            <label>{{ $t('播放次数') }}</label>
            <t-input-number
              v-model="item.cycle"
              theme="column"
              :min="1"
              @change="changeValue"
              :placeholder="$t('无限')"
              :title="$t('缺省无限循环播放')"
            ></t-input-number>
          </div>
          <div class="form-item mt-8">
            <label>{{ $t('自动播放') }}</label>
            <t-switch
              class="ml-8 mt-8"
              size="small"
              :value="pen.autoPlay && pen.currentAnimation === i"
              @change="changeAutoPlay(Number(i))"
            ></t-switch>
          </div>
        </t-collapse-panel>
      </t-collapse>
      <t-divider />
      <div class="p-16">
        <t-button class="w-full" @click="addAnimate" style="height: 30px">
          {{ $t('添加动画') }}
        </t-button>
      </div>
    </template>
    <div class="flex column center blank" v-else>
      <div class="gray center">{{ $t('还没有动画') }}</div>
      <div class="mt-8">
        <t-button @click="addAnimate" style="height: 30px">{{ $t('添加动画') }}</t-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, toRaw, toRefs } from 'vue';
import { StopCircleIcon, PlayCircleIcon, DeleteIcon } from 'tdesign-icons-vue-next';
import { Meta2d, Mode } from '@meta2d/core';
import { useSelection } from './services/selections';
import { presetPalettes } from './services/const';

const { selections } = useSelection();
const { pen } = toRefs(selections) as any;

// 画布以 Web Component 形式挂载，调用时实时获取，避免组件先于画布初始化
const getMeta2d = () => document.querySelector('le5le-meta2d') as unknown as Meta2d;

const playing = ref<number>();

// 连线动画类型（值与 core 的 LineAnimationType 对应）
const lineAnimateList = [
  { label: '水流', value: 0 },
  { label: '水珠', value: 1 },
  { label: '圆点', value: 2 },
];

// 水珠动画的虚线样式
const lineDashOptions = [
  [5, 5],
  [10, 10],
  [10, 10, 2, 10],
];

// 节点动画预设帧
const animateList = [
  {
    label: '闪烁',
    value: '闪烁',
    data: [
      { properties: { visible: true }, transitional: { visible: false }, duration: 100 },
      { properties: { visible: false }, transitional: { visible: false }, duration: 100 },
    ],
  },
  {
    label: '缩放',
    value: '缩放',
    data: [
      { properties: { scale: 1.1 }, transitional: { scale: true }, duration: 100 },
      { properties: { scale: 1 }, transitional: { scale: true }, duration: 400 },
    ],
  },
  {
    label: '旋转',
    value: '旋转',
    data: [{ properties: { rotate: 360 }, transitional: { rotate: true }, duration: 1000 }],
  },
  {
    label: '逆向旋转',
    value: '逆向旋转',
    data: [{ properties: { rotate: -360 }, transitional: { rotate: true }, duration: 1000 }],
  },
  {
    label: '上下跳动',
    value: '上下跳动',
    data: [
      { properties: { y: -10 }, transitional: { y: true }, duration: 100, timingFunction: 0 },
      { properties: { y: 10 }, transitional: { y: true }, duration: 100, timingFunction: 0 },
      { properties: { y: -10 }, transitional: { y: true }, duration: 200, timingFunction: 0 },
    ],
  },
  {
    label: '左右跳动',
    value: '左右跳动',
    data: [
      { properties: { x: -10 }, transitional: { x: true }, duration: 100 },
      { properties: { x: 10 }, transitional: { x: true }, duration: 80 },
      { properties: { x: -10 }, transitional: { x: true }, duration: 50 },
      { properties: { x: 10 }, transitional: { x: true }, duration: 30 },
      { properties: { x: 10 }, transitional: { x: true }, duration: 300 },
    ],
  },
  {
    label: '颜色变化',
    value: '颜色变化',
    data: [
      { properties: { color: '#4583ff' }, transitional: { color: false }, duration: 200 },
      { properties: { color: '#ff4000' }, transitional: { color: false }, duration: 200 },
    ],
  },
  {
    label: '背景变化',
    value: '背景变化',
    data: [
      { properties: { background: '#4583ff' }, transitional: { background: false }, duration: 200 },
      { properties: { background: '#ff4000' }, transitional: { background: false }, duration: 200 },
    ],
  },
  {
    label: '文字变化',
    value: '文字变化',
    data: [
      { properties: { text: '乐吾乐' }, transitional: { text: false }, duration: 200 },
      { properties: { text: 'le5le' }, transitional: { text: false }, duration: 200 },
    ],
  },
];

// selections.pen 是克隆对象，修改后需要同步回画布
const changeValue = () => {
  if (!pen.value) {
    return;
  }
  const val = toRaw(pen.value);
  getMeta2d().setValue({ id: val.id, animations: val.animations }, { mode: Mode.Edit });
};

const changeLineDash = (index: number, animation: any) => {
  animation.lineAnimation.lineDash = lineDashOptions[index];
  changeValue();
};

// 选择预设动画时，写入对应的帧数据
const changeAnimate = (item: any) => {
  const preset = animateList.find((elem) => elem.value === item.animate);
  if (!preset) {
    return;
  }
  item.frames = structuredClone(preset.data);
  changeValue();
};

// 自动播放：同一图元只能有一个自动播放的动画，由 autoPlay + currentAnimation 决定
const changeAutoPlay = (i: number) => {
  if (!pen.value) {
    return;
  }
  if (pen.value.autoPlay && pen.value.currentAnimation === i) {
    pen.value.autoPlay = false;
    pen.value.currentAnimation = undefined;
  } else {
    pen.value.autoPlay = true;
    pen.value.currentAnimation = i;
  }
  const val = toRaw(pen.value);
  getMeta2d().setValue(
    { id: val.id, autoPlay: val.autoPlay, currentAnimation: val.currentAnimation },
    { mode: Mode.Edit },
  );
};

const play = (i: number) => {
  if (!pen.value) {
    return;
  }
  if (playing.value !== undefined) {
    stop();
  }
  playing.value = i;
  getMeta2d().startAnimate(pen.value.id, { currentAnimation: i });
};

const stop = () => {
  playing.value = undefined;
  getMeta2d().stopAnimate(pen.value.id);
};

const addAnimate = () => {
  if (!pen.value.animations) {
    pen.value.animations = [];
  }
  const name = `动画${pen.value.animations.length + 1}`;
  if (pen.value.category) {
    pen.value.animations.push({ name, lineAnimation: { type: 0 } });
  } else {
    pen.value.animations.push({ name, animate: '' });
  }
  changeValue();
};

const delAnimate = (i: number) => {
  if (playing.value !== undefined) {
    stop();
  }
  pen.value.animations.splice(i, 1);

  // 删除后修正自动播放的动画索引
  const current = pen.value.currentAnimation;
  if (current !== undefined) {
    if (current === i) {
      pen.value.autoPlay = false;
      pen.value.currentAnimation = undefined;
    } else if (current > i) {
      pen.value.currentAnimation = current - 1;
    }
    const val = toRaw(pen.value);
    getMeta2d().setValue(
      { id: val.id, autoPlay: val.autoPlay, currentAnimation: val.currentAnimation },
      { mode: Mode.Edit },
    );
  }
  changeValue();
};
</script>
<style lang="postcss" scoped>
.animations {
  height: 100%;
  padding: 16px;
  .blank {
    height: 70%;
  }

  :deep(.t-collapse) {
    .t-collapse-panel__header {
      padding: 0;
    }
    .t-collapse-panel__icon:hover {
      background: none;
      svg {
        color: var(--color-primary);
      }
    }
  }
}
</style>
