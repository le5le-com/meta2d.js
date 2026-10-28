<template>
  <div class="animate-frames props">
    <div class="head">
      <label>{{ animate.name }} </label>
      <close-icon class="hover" style="font-size: 16px" @click="close" />
    </div>
    <div style="height: calc(100% - 42px); overflow: auto">
      <template v-if="animate.frames.length">
        <t-collapse v-model="openedCollapses" :borderless="true" :expand-on-row-click="true" @change="onChangeCollapse">
          <t-collapse-panel v-for="(item, i) in animate.frames" :value="i">
            <template #header>
              <label style="font-weight: normal">{{ $t('帧') + (i + 1) }}</label>
            </template>
            <template #headerRightContent>
              <t-space size="small" @click.stop>
                <t-tooltip :content="$t('在当前帧后面添加动画帧')">
                  <folder-add-icon class="hover ml-4" @click="addFrame(i)"></folder-add-icon>
                </t-tooltip>
                <t-tooltip :content="$t('添加属性')">
                  <t-dropdown :options="propOptions" @click="addProp(i, $event)" :minColumnWidth="150">
                    <file-add-icon class="hover ml-4"></file-add-icon>
                  </t-dropdown>
                </t-tooltip>
                <t-popconfirm
                  placement="left"
                  @confirm="animate.frames.splice(i, 1)"
                  :content="$t('确认删除该动画帧吗')"
                >
                  <delete-icon class="hover ml-4"></delete-icon>
                </t-popconfirm>
              </t-space>
            </template>
            <section>
              <div class="form-item">
                <label>{{ $t('时长') }}</label>
                <t-input-number
                  v-model="item.duration"
                  theme="normal"
                  :min="1"
                  suffix="ms"
                  :placeholder="$t('毫秒')"
                ></t-input-number>
              </div>
              <div class="form-item mt-8" v-for="(prop, index) in frameProps[i]">
                <template v-if="propDescriptions[prop]">
                  <label>
                    {{ propDescriptions[prop].label }}
                  </label>

                  <div>
                    <t-input-number
                      class="w-full"
                      v-if="propDescriptions[prop].type === 'number'"
                      v-model="item[prop]"
                      theme="normal"
                      :placeholder="propDescriptions[prop].placeholder"
                      :min="propDescriptions[prop].min"
                      :max="propDescriptions[prop].max"
                      :step="propDescriptions[prop].step"
                    />
                    <t-select
                      class="w-full"
                      v-else-if="propDescriptions[prop].type === 'select'"
                      v-model="item[prop]"
                      :placeholder="propDescriptions[prop].placeholder"
                      :options="propDescriptions[prop].options"
                    />
                    <t-color-picker
                      class="w-full"
                      v-else-if="propDescriptions[prop].type === 'color'"
                      v-model="item[prop]"
                      :placeholder="propDescriptions[prop].placeholder"
                      format="CSS"
                      :recent-colors="null"
                      :enable-alpha="true"
                      :color-modes="
                        propDescriptions[prop].colorModes ||
                        propDescriptions[prop].colorModesFn(item[propDescriptions[prop].colorModesBind])
                      "
                      :swatch-colors="presetPalettes"
                      :show-primary-color-preview="false"
                    />
                    <t-switch
                      v-else-if="propDescriptions[prop].type === 'bool'"
                      v-model="item[prop]"
                      class="ml-8 mt-8"
                      size="small"
                    />
                    <t-select
                      class="w-full"
                      v-else-if="propDescriptions[prop].type === 'child'"
                      v-model="item[prop]"
                      :placeholder="propDescriptions[prop].placeholder"
                    >
                      <t-option
                        v-for="(child, i) in selections.pen.children"
                        :key="i"
                        :value="i"
                        :label="`${$t('状态')}${i + 1}`"
                      />
                    </t-select>
                    <t-input
                      class="w-full"
                      v-else
                      v-model="item[prop]"
                      :placeholder="propDescriptions[prop].placeholder"
                    />
                  </div>
                </template>
                <template v-else>
                  <label>
                    {{ prop }}
                  </label>
                  <div>
                    <t-input class="w-full" v-model="item[prop]" />
                  </div>
                </template>
                <close-icon class="hover" @click="closeItem(frameProps[i], index)" />
              </div>
            </section>
          </t-collapse-panel>
        </t-collapse>
        <t-divider />
        <div class="mt-16 px-16">
          <t-button class="w-full" @click="addFrame()" style="height: 30px">
            {{ $t('添加帧') }}
          </t-button>
        </div>
      </template>
      <div class="flex column center blank" v-else>
        <div class="gray center">{{ $t('还没有动画帧') }}</div>
        <div class="mt-8">
          <t-button @click="addFrame()" style="height: 30px">{{ $t('添加动画帧') }}</t-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue';

import { useSelection } from './services/selections';
import { presetPalettes } from './services/const';
import { CloseIcon, FolderAddIcon, FileAddIcon, DeleteIcon } from 'tdesign-icons-vue-next';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const { animate } = defineProps<{
  animate: { name: string; frames: any[] };
}>();

const emit = defineEmits(['close']);

const { selections }: { selections: any } = useSelection();

const openedCollapses = ref([0]);

const frameProps: any = ref([]);

const propDescriptions: any = {
  visible: {
    label: t('显示'),
    type: 'bool',
  },
  scale: {
    label: t('缩放'),
    type: 'number',
    min: 0.01,
    max: 100,
    placeholder: t('缩放比例'),
  },
  rotate: {
    label: t('旋转'),
    type: 'number',
    min: 0,
    max: 360,
    placeholder: '°',
  },
  x: {
    label: t('X位移'),
    type: 'number',
    placeholder: 'px',
  },
  y: {
    label: t('Y位移'),
    type: 'number',
    placeholder: 'px',
  },
  color: {
    label: t('前景颜色'),
    type: 'color',
    colorModes: ['monochrome'],
  },
  bkType: {
    label: t('背景类型'),
    type: 'select',
    options: [
      {
        label: t('纯色'),
        value: 0,
      },
      {
        label: t('线性渐变'),
        value: 1,
      },
      {
        label: t('径向渐变'),
        value: 2,
      },
    ],
  },
  background: {
    label: t('背景颜色'),
    type: 'color',
    colorModesFn: (t: number) => {
      if (t > 0) {
        return ['linear-gradient'];
      } else {
        return ['monochrome'];
      }
    },
    colorModesBind: 'bkType',
  },
  text: {
    label: t('文字'),
  },
  showChild: {
    label: t('状态'),
    type: 'child',
  },
  flipX: {
    label: t('水平翻转'),
    type: 'bool',
  },
  flipY: {
    label: t('垂直翻转'),
    type: 'bool',
  },
  progress: {
    label: t('进度'),
    type: 'number',
    step: 0.1,
    min: 0,
    max: 1,
    placeholder: t('0 - 1之间'),
  },
  progressColor: {
    label: t('进度颜色'),
    type: 'color',
    colorModes: ['monochrome'],
  },
  verticalProgress: {
    label: t('垂直进度'),
    type: 'bool',
  },
  globalAlpha: {
    label: t('透明度'),
    type: 'number',
    step: 0.1,
    min: 0,
    max: 1,
    placeholder: t('0 - 1之间'),
  },
  dash: {
    label: t('线条样式'),
    type: 'select',
    options: [
      {
        label: `—————————`,
        value: 0,
      },
      {
        label: `- - - - - - - - - - - - -`,
        value: 1,
      },
      {
        label: `—  —  —  —  —  — — `,
        value: 2,
      },
      {
        label: `— - — - — - — - —`,
        value: 3,
      },
    ],
  },
  gradientRadius: {
    label: t('背景渐变半径'),
    type: 'number',
    min: 0,
    max: 1,
    placeholder: t('0 - 1之间'),
  },
  lineWidth: {
    label: t('线条宽度'),
    type: 'number',
    min: 1,
    placeholder: 'px',
  },
  strokeType: {
    label: t('线条渐变'),
    type: 'bool',
  },
  lineGradientColors: {
    label: t('线条渐变颜色'),
    type: 'color',
    colorModes: ['linear-gradient'],
  },
  fontFamily: {
    label: t('显示阴影'),
    type: 'select',
    options: [
      {
        label: t('新宋体'),
        value: t('新宋体'),
      },
      {
        label: t('微软雅黑'),
        value: t('微软雅黑'),
      },
      {
        label: t('黑体'),
        value: t('黑体'),
      },
      {
        label: t('楷体'),
        value: t('楷体'),
      },
      {
        label: '-apple-system',
        value: '-apple-system',
      },
      {
        label: 'BlinkMacSystemFont',
        value: 'BlinkMacSystemFont',
      },
      {
        label: 'PingFang SC',
        value: 'PingFang SC',
      },
      {
        label: 'Hiragino Sans GB',
        value: 'Hiragino Sans GB',
      },
      {
        label: 'Microsoft YaHei UI',
        value: 'Microsoft YaHei UI',
      },
      {
        label: 'Microsoft YaHei',
        value: 'Microsoft YaHei',
      },
      {
        label: 'fangsong',
        value: 'fangsong',
      },
      {
        label: 'Source Han Sans CN',
        value: 'Source Han Sans CN',
      },
      {
        label: 'sans-serif',
        value: 'sans-serif',
      },
      {
        label: 'serif',
        value: 'serif',
      },
      {
        label: 'Apple Color Emoji',
        value: 'Apple Color Emoji',
      },
      {
        label: 'Segoe UI Emoji',
        value: 'Segoe UI Emoji',
      },
      {
        label: 'Segoe UI Symbol',
        value: 'Segoe UI Symbol',
      },
    ],
  },
  fontSize: {
    label: t('字体大小'),
    type: 'number',
    min: 1,
    placeholder: 'px',
  },
  textColor: {
    label: t('文字颜色'),
    type: 'color',
    colorModes: ['monochrome'],
  },
  textBackground: {
    label: t('文字背景'),
    type: 'color',
    colorModes: ['monochrome'],
  },
  fontStyle: {
    label: t('文字倾斜'),
    type: 'select',
    options: [
      {
        label: t(`正常`),
        value: 'normal',
      },
      {
        label: t(`倾斜`),
        value: 'italic',
      },
    ],
  },
  fontWeight: {
    label: t('文字加粗'),
    type: 'select',
    options: [
      {
        label: t(`正常`),
        value: 'normal',
      },
      {
        label: t(`加粗`),
        value: 'bold',
      },
    ],
  },
  textHasShadow: {
    label: t('文字阴影'),
    type: 'bool',
  },
  shadow: {
    label: t('显示阴影'),
    type: 'bool',
  },
  shadowColor: {
    label: t('阴影颜色'),
    type: 'color',
    colorModes: ['monochrome'],
  },
  shadowBlur: {
    label: t('阴影模糊半径'),
    type: 'number',
    min: 0,
    placeholder: t('正数'),
  },
  shadowOffsetX: {
    label: t('阴影X偏移'),
    type: 'number',
    placeholder: 'px',
  },
  shadowOffsetY: {
    label: t('阴影Y偏移'),
    type: 'number',
    placeholder: 'px',
  },
};

const propOptions: any = reactive([]);

onMounted(() => {
  onChangeCollapse([0]);

  Object.keys(propDescriptions).forEach((key) => {
    propOptions.push({
      value: key,
      content: propDescriptions[key].label,
    });
  });
});

const closeItem = (frameProp, index) => {
  let deletePropName = frameProp.splice(index, 1);
  delete frameProp.target[deletePropName];
};

const addFrame = (i?: number) => {
  if (i == undefined) {
    i = animate.frames.length - 1;
  }
  animate.frames.splice(i + 1, 0, {});

  openedCollapses.value = [i + 1];
  onChangeCollapse(openedCollapses.value);
};

const onChangeCollapse = (val: number[]) => {
  if (!animate.frames.length) {
    return;
  }
  frameProps.value = [];
  for (let i = 0; i < animate.frames.length; i++) {
    frameProps.value[i] = [];
  }
  for (const i of val) {
    frameProps.value[i]['target'] = animate.frames[i];
    Object.keys(animate.frames[i]).forEach((key) => {
      if (key !== 'duration') {
        frameProps.value[i].push(key);
      }
    });
  }
};

const addProp = (i: number, e: { value: string }) => {
  const found = frameProps.value[i].findIndex((key: string) => key === e.value);
  if (found < 0) {
    frameProps.value[i].push(e.value);
  }
};

const close = () => {
  emit('close');
};
</script>
<style lang="postcss" scoped>
.animate-frames {
  z-index: 2;
  position: fixed;
  top: 100px;
  bottom: 12px;
  right: 308px;
  width: 300px;
  border: 1px solid var(--color-border-input);
  border-radius: 4px;
  box-shadow: rgba(39, 54, 78, 0.08) 0px 2px 10px 0px, rgba(39, 54, 78, 0.1) 4px 12px 40px 0px;
  background: var(--color-background);

  & > .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--color-background-popup);
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1;
    color: var(--color-title);
  }

  .blank {
    height: 70%;
    img {
      padding: 16px;
      opacity: 0.9;
    }
  }

  .form-item {
    position: relative;

    & > div {
      width: 190px;
      flex-shrink: 0;
    }

    & > svg {
      flex-shrink: 0;
      visibility: hidden;
    }

    &:hover {
      & > svg {
        visibility: visible;
      }
    }
  }

  :deep(.t-collapse) {
    .t-collapse-panel__header {
      .t-input {
        border-color: transparent;
        &:hover {
          border-color: var(--color-border-input);
        }
      }
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
