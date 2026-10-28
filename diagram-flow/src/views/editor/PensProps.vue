<template>
  <t-tabs class="props" value="1">
    <t-tab-panel value="1" :label="$t('外观')" class="panel">
      <t-space direction="vertical" class="w-full">
        <div class="flex between" style="margin-bottom: 2px">
          <label>{{ $t('选中了') }}{{ selections.pens?.length || 0 }}{{ $t('个图元') }}</label>
          <div class="icons">
            <t-tooltip class="mr-4" v-if="!data.locked" placement="top" :content="$t('可编辑')">
              <svg class="l-icon" aria-hidden="true" @click="lock(1)">
                <use xlink:href="#l-unlock"></use>
              </svg>
            </t-tooltip>
            <t-tooltip class="mr-4" v-else-if="data.locked == 1" placement="top" :content="$t('禁止编辑')">
              <svg class="l-icon" aria-hidden="true" @click="lock(2)">
                <use xlink:href="#l-lock"></use>
              </svg>
            </t-tooltip>
            <t-tooltip class="mr-4" v-else-if="data.locked == 2" placement="top" :content="$t('禁止编辑和移动')">
              <svg class="l-icon" aria-hidden="true" @click="lock(10)">
                <use xlink:href="#l-wufayidong"></use>
              </svg>
            </t-tooltip>
            <t-tooltip class="mr-4" v-else-if="data.locked == 10" placement="top" :content="$t('禁止所有事件')">
              <svg class="l-icon" aria-hidden="true" @click="lock(0)">
                <use xlink:href="#l-jinyong"></use>
              </svg>
            </t-tooltip>
            <browse-icon v-if="data.visible !== false" @click="visible(false)" class="ml-8"></browse-icon>
            <browse-off-icon v-else @click="visible(true)" class="ml-8"></browse-off-icon>
          </div>
        </div>
        <t-collapse :defaultValue="['1', '2', '3', '4']" expandIconPlacement="right" :borderless="true">
          <t-divider style="margin: 0 -16px; width: 120%" />
          <t-collapse-panel value="1" :header="$t('对齐')">
            <t-space direction="vertical" size="small" class="w-full">
              <div class="icons mt-8 mb-8">
                <t-tooltip v-for="item in aligns" :content="item.label" placement="top">
                  <svg
                    class="l-icon btn"
                    aria-hidden="true"
                    @mouseenter="previewAlign"
                    @mouseleave="recoverAlign"
                    @click="align(item.value)"
                  >
                    <use :xlink:href="item.icon"></use>
                  </svg>
                </t-tooltip>
              </div>
            </t-space>
          </t-collapse-panel>
          <t-divider style="margin: 0 -16px; width: 120%" />
          <t-collapse-panel value="2" :header="$t('外观')">
            <AppearancePanel v-model="data" @change="changeValue" />
          </t-collapse-panel>

          <t-divider style="margin: 0 -16px; width: 120%" />

          <t-collapse-panel class="mt-16" value="3" :header="$t('文字')">
            <TextPanel v-model="data" @change="changeValue" />
          </t-collapse-panel>
          <t-divider style="margin: 0 -16px; width: 120%" />

          <t-collapse-panel class="mt-16" value="4" :header="$t('其他')">
            <OtherPanel v-model="data" @change="changeValue" />
          </t-collapse-panel>
        </t-collapse>
      </t-space>
    </t-tab-panel>
  </t-tabs>
</template>
<script lang="ts" setup>
import { computed, onMounted, reactive, toRaw } from 'vue';
import { LockState } from './services/const';
import { BrowseIcon, BrowseOffIcon } from 'tdesign-icons-vue-next';
import { useI18n } from 'vue-i18n';
import { Meta2d, Mode, AlignType } from '@meta2d/core';

import { useSelection } from './services/selections';
import AppearancePanel from './components/AppearancePanel.vue';
import TextPanel from './components/TextPanel.vue';
import OtherPanel from './components/OtherPanel.vue';

const { t } = useI18n();

const aligns = [
  {
    value: AlignType.Left,
    label: t('左对齐'),
    icon: '#l-align-left',
  },
  {
    value: AlignType.Center,
    label: t('垂直居中对齐'),
    icon: '#l-align-center',
  },
  {
    value: AlignType.Right,
    label: t('右对齐'),
    icon: '#l-align-right',
  },
  {
    value: AlignType.Top,
    label: t('顶部对齐'),
    icon: '#l-align-top',
  },
  {
    value: AlignType.Middle,
    label: t('水平居中对齐'),
    icon: '#l-align-middle',
  },
  {
    value: AlignType.Bottom,
    label: t('底部对齐'),
    icon: '#l-align-bottom',
  },
  {
    value: AlignType.HorizontalDistribute,
    label: t('水平等距'),
    icon: '#l-horizontal-between',
  },
  {
    value: AlignType.VerticalDistribute,
    label: t('垂直等距'),
    icon: '#l-vertical-between',
  },
];

const { selections } = useSelection();

const data = reactive<any>({
  locked: 0,
  lineWidth: 1,
});

let meta2d: Meta2d;

onMounted(async () => {
  meta2d = document.querySelector('le5le-meta2d') as Meta2d;
});

const changeValue = (key: string) => {
  if (!meta2d || !selections.pens || selections.pens.length === 0) {
    return;
  }

  const vals = [];
  const val = toRaw(data);
  for (const pen of selections.pens) {
    vals.push({ id: pen.id, [key]: val[key] });
  }
  meta2d.setValue(vals, { mode: Mode.Edit });

  // 文字、线宽等引起包围盒大小变化时，重新调整活动框
  // 延迟20ms是等待画布后台线程文字区域更新
  setTimeout(() => {
    meta2d.active();
  }, 20);
};

function previewAlign() {}

function recoverAlign() {}

const lock = (v: LockState) => {
  data.locked = v;
};

const visible = (v: boolean) => {
  data.visible = v;
};

const align = (alignType: AlignType) => {
  if(alignType === AlignType.HorizontalDistribute || alignType === AlignType.VerticalDistribute) {
    meta2d.distributePensEvenly(alignType);
  } else {
    meta2d.alignPens(alignType);
  }
};
</script>
<style lang="postcss" scoped>
.props {
  .icons {
    display: flex;
    align-items: center;
    svg:hover {
      cursor: pointer;
      color: var(--color-primary);
    }

    .btn {
      font-size: 16px;
      margin-right: 16px;
      color: var(--color);
    }
    .l-icon {
      width: 1em;
      height: 1em;
      fill: currentColor;
      overflow: hidden;
    }
  }
  :deep(.t-collapse-panel__header) {
    padding-inline: 0;
  }
}
</style>
