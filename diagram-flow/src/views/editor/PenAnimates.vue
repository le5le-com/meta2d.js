<template>
  <div class="animations">
    <template v-if="pen.animations?.length">
      <t-collapse :borderless="true" :defaultExpandAll="true" :expand-on-row-click="true">
        <t-collapse-panel v-for="(item, i) in pen.animations" :value="i">
          <template #header>
            <div class="flex middle" @click.stop>
              <t-input :title="item.name" :value="item.name" autoWidth class="mr-8" style="max-width: 60px" />
              <stop-circle-icon v-if="playing === i" class="hover primary" style="font-size: 16px" @click="stop" />
              <play-circle-icon v-else class="hover" style="font-size: 16px" @click="play(i)" />
            </div>
          </template>
          <template #headerRightContent>
            <t-space size="small" @click.stop>
              <edit-icon v-if="!pen.type && item.animate" class="hover mr-4" @click="animate = item" />
              <t-popconfirm :content="$t('确认删除该动画吗')" placement="left" @confirm="delAnimate(i)">
                <delete-icon class="hover" />
              </t-popconfirm>
            </t-space>
          </template>
          <template v-if="pen.category">
            <div class="form-item">
              <label>{{ $t('动画类型') }}</label>
              <t-select v-model="item.lineAnimation.type" @change="changeValue(i)" :placeholder="$t('水流')">
                <t-option :key="0" :value="0" :label="$t('水流')"></t-option>
                <t-option :key="1" :value="1" :label="$t('水珠')"></t-option>
                <t-option :key="2" :value="2" :label="$t('圆点')"></t-option>
                <!-- <t-option :key="5" :value="5" :label="$t('自定义轨迹动画')"></t-option> -->
                <t-option :key="3" :value="3" :label="$t('箭头')"></t-option>
                <t-option :key="4" :value="4" :label="$t('水滴')"></t-option>
                <t-option :key="5" :value="5" :label="$t('图片')"></t-option>
                <t-option :key="6" :value="6" :label="$t('图标')"></t-option>
                <t-option :key="7" :value="7" :label="$t('图元')"></t-option>
                <t-option :key="8" :value="8" :label="$t('代码')"></t-option>
              </t-select>
            </div>
              <div v-if="item.lineAnimation.type === 5" class="form-item mt-12">
                <label>{{ $t('图片url') }}</label>
                  <t-input
                    @change="changeValue(i)"
                    v-model="item.lineAnimation.image"
                    :placeholder="$t('请输入')"
                  />
              </div>
              <div v-if="item.lineAnimation.type === 7" class="form-item mt-12">
                <label>{{ $t('目标图元') }} </label>
                  <t-input
                    @change="changeValue(i)"
                    v-model="item.lineAnimation.target"
                    :placeholder="$t('图元id/tag')"
                  />
              </div>
            <div  v-if="[3,4,5,6,8].includes(item.lineAnimation.type)" class="form-item mt-8">
              <label>{{ $t('元素数量') }}</label>
              <t-input-number
                v-model="item.lineAnimation.count"
                theme="column"
                :min="1"
                @change="changeValue(i)"
                :placeholder="$t('默认loop')"
              ></t-input-number>
            </div>
              <div v-if="item.lineAnimation.type>=3" class="form-item mt-12">
                <label>{{ $t('间隔') }} </label>
                  <t-input
                    @change="changeValue(i)"
                    v-model="item.lineAnimation.lineDash"
                    :placeholder="$t('如10,20')"
                  />
              </div>
              <div v-if="item.lineAnimation.type===1" class="form-item mt-12">
                <label>{{ $t('线条样式') }} </label>
                <t-select :placeholder="$t('线条样式')"  @change="changeLineDash($event,item)">
                  <template #valueDisplay="{ value }">
                    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="width: 100%; height: 20px">
                      <g fill="none" stroke="var(--color)" stroke-width="1">
                        <path d="M0 9 l85 0" :stroke-dasharray="item.lineAnimation.lineDash?.join(' ')" />
                      </g>
                    </svg>
                  </template>
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
            <div class="form-item mt-8">
              <label>{{ $t('运动速度') }}</label>
              <t-slider
                class="ml-12"
                v-model="item.lineAnimation.span"
                :show-tooltip="true"
                :min="1"
                :max="10"
                @change="changeValue(i)"
              />
            </div>
            <!-- <section v-else>
              <div class="form-item mt-8">
                <label>{{ $t('动画时长') }}</label>
                <t-input-number
                  theme="column"
                  :min="1"
                  :placeholder="$t('单位秒，默认5秒')"
                  v-model="item.duration"
                  @change="changeValue(i)"
                ></t-input-number>
              </div>
            </section> -->

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
                @change="changeValue(i)"
              ></t-color-picker>
            </div>

            <div class="form-item mt-8">
              <label>{{ $t('发光效果') }}</label>
              <t-switch class="ml-8 mt-8" size="small" v-model="item.lineAnimation.shadow" @change="changeValue(i)" />
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
                @change="changeValue(i)"
              ></t-color-picker>
            </div>
            <div v-if="item.lineAnimation.shadow" class="form-item mt-8">
              <label>{{ $t('发光模糊') }}</label>
              <t-input-number
                v-model="item.lineAnimation.shadowBlur"
                theme="column"
                :min="1"
                @change="changeValue(i)"
                :placeholder="$t('默认6')"
              ></t-input-number>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('轨迹宽度') }}</label>
              <t-input-number
                v-model="item.lineAnimation.lineWidth"
                theme="column"
                :min="1"
                @change="changeValue(i)"
                :placeholder="$t('')"
              ></t-input-number>
            </div>

            <div v-if="item.lineAnimation.type === 3 || item.lineAnimation.type === 4" class="form-item mt-8">
              <label>{{ $t('轨迹间隔') }}</label>
              <t-input-number
                v-model="item.lineAnimation.markerSpacing"
                theme="column"
                :min="1"
                @change="changeValue(i)"
                :placeholder="$t('默认100')"
              ></t-input-number>
            </div>

            <div class="form-item mt-8">
              <label>{{ $t('反向流动') }}</label>
              <t-switch
                class="ml-8 mt-8"
                size="small"
                v-model="item.lineAnimation.reverse"
                @change="changeValue(i)"
              ></t-switch>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('播放次数') }}</label>
              <t-input-number
                v-model="item.cycle"
                theme="column"
                :min="1"
                @change="changeValue(i)"
                :placeholder="$t('无限')"
                :title="$t('缺省无限循环播放')"
              ></t-input-number>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('自动播放') }}</label>
              <t-switch class="ml-8 mt-8" size="small" v-model="pen.autoPlay"></t-switch>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('下个动画类型') }}</label>
              <t-radio-group class="ml-8" v-model="item.temType" @change="item.nextAnimate = ''">
                <t-radio value="id">{{ $t('图元') }}</t-radio>
                <t-radio value="tag">{{ $t('组') }}</t-radio>
              </t-radio-group>
            </div>
            <div class="form-item mt-8" :title="$t('当前动画结束后自动播放下一个对象的动画')">
              <label>{{ $t('下个动画') }}</label>
            </div>
          </template>
          <template v-else>
            <div class="form-item">
              <label>{{ $t('动画类型') }}</label>
              <t-select v-model="item.animate" clearable :placeholder="$t('动画')"></t-select>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('播放次数') }}</label>
              <t-input-number
                v-model="item.animateCycle"
                theme="column"
                :min="1"
                :placeholder="$t('无限')"
                :title="$t('缺省无限循环播放')"
              ></t-input-number>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('结束状态') }}</label>
              <t-select v-model="item.keepAnimateState" :placeholder="$t('初始状态')">
                <t-option :key="false" :value="false" :label="$t('初始状态')"></t-option>
                <t-option :key="true" :value="true" :label="$t('当前状态')"></t-option>
              </t-select>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('线性播放') }}</label>
              <t-tooltip placement="top" :content="$t('仅支持数字属性匀速线性播放')">
                <t-select v-model="item.linear" :placeholder="$t('是')">
                  <t-option :key="true" :value="true" :label="$t('是')"></t-option>
                  <t-option :key="false" :value="false" :label="$t('否')"></t-option>
                </t-select>
              </t-tooltip>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('自动播放') }}</label>
              <t-switch class="ml-8 mt-8" size="small" v-model="item.autoPlay"></t-switch>
            </div>
            <div class="form-item mt-8">
              <label>{{ $t('下个动画类型') }}</label>
              <t-radio-group class="ml-8" v-model="item.temType" @change="item.nextAnimate = ''">
                <t-radio value="id">{{ $t('图元') }}</t-radio>
                <t-radio value="tag">{{ $t('组') }}</t-radio>
              </t-radio-group>
            </div>
            <div class="form-item mt-8" :title="$t('当前动画结束后自动播放下一个对象的动画')">
              <label>{{ $t('下个动画') }}</label>
            </div>
          </template>
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
  <AnimateFrames v-if="animate" :animate="animate" @close="animate = undefined" />
</template>

<script lang="ts" setup>
import { onMounted, ref, toRaw, toRefs, computed } from 'vue';
import { StopCircleIcon, PlayCircleIcon } from 'tdesign-icons-vue-next';

import { Meta2d, Mode } from '@meta2d/core';

import { useSelection } from './services/selections';
import { presetPalettes } from './services/const';

const { selections } = useSelection();

const { pen } = toRefs(selections) as any;

let meta2d: Meta2d;

const playing = ref<number>();

const animate = ref<any>();

const lineDashOptions = [
  [5, 5],
  [10, 10],
  [10, 10, 2, 10],
];

onMounted(async () => {
  meta2d = document.querySelector('le5le-meta2d') as Meta2d;
});

const changeValue = (i: number) => {
  if (!pen.value) {
    return;
  }
  const val = toRaw(pen.value);
  meta2d.setValue({ id: val.id, animations: val.animations }, { mode: Mode.Edit });
};

const changeLineDash = (value: any, animation: any) => {
  animation.lineAnimation.lineDash = lineDashOptions[value];
  console.log(value,animation.lineAnimation.lineDash)
  changeValue(0);
};

const changeAnimate = (value: any, animation: any) => {
  animation.name = value;
  changeValue(0);
};

const changeCycle = (value: any, animation: any) => {
  animation.cycle = value;
  changeValue(0);
}

const play = (i: number) => {
  if (!pen.value) {
    return;
  }
  playing.value = i;
  meta2d.startAnimate(pen.value.id, { currentAnimation: i });
};

const stop = () => {
  playing.value = undefined;
  meta2d.stopAnimate(pen.value.id);
};

const addAnimate = () => {
  if (!pen.value.animations) {
    pen.value.animations = [];
  }
  pen.value.animations.push({
    name: '',
    lineAnimation: {},
    cycle: 2,
  });
  const val = toRaw(pen.value);
  meta2d.setValue({ id: val.id, animations: val.animations }, { mode: Mode.Edit });
};

const delAnimate = (i: number) => {};
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
