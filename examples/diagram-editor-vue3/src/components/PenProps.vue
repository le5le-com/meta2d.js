<template>
  <div class="props-panel">
    <t-form label-align="left" v-if="pen">
      <h5 class="mb-24">图元</h5>
      <t-form-item label="文本" name="text">
        <t-input v-model="pen.text" @change="changeValue('text')" />
      </t-form-item>
      <t-form-item label="颜色" name="color">
        <t-color-picker
          class="w-full"
          v-model="pen.color"
          :show-primary-color-preview="false"
          format="CSS"
          :color-modes="['monochrome']"
          @change="changeValue('color')"
        />
      </t-form-item>
      <t-form-item label="背景" name="background">
        <t-color-picker
          class="w-full"
          v-model="pen.background"
          :show-primary-color-preview="false"
          format="CSS"
          :color-modes="['monochrome']"
          @change="changeValue('background')"
        />
      </t-form-item>
      <t-form-item label="线条" name="dash">
        <t-select v-model="pen.dash" @change="changeValue('dash')">
          <t-option :key="0" :value="0" label="实线"></t-option>
          <t-option :key="1" :value="1" label="虚线"></t-option>
        </t-select>
      </t-form-item>
      <t-form-item label="圆角" name="borderRadius">
        <t-input-number
          :min="0"
          :max="1"
          :step="0.01"
          v-model="pen.borderRadius"
          @change="changeValue('borderRadius')"
        />
      </t-form-item>
      <t-form-item label="不透明度" name="globalAlpha">
        <t-slider
          v-model="pen.globalAlpha"
          :min="0"
          :max="1"
          :step="0.01"
          @change="changeValue('globalAlpha')"
        />
        <span class="ml-16" style="width: 50px; line-height: 30px">
          {{ pen.globalAlpha }}
        </span>
      </t-form-item>

      <t-divider />

      <t-form-item label="X" name="x">
        <t-input-number v-model="rect.x" @change="changeRect('x')" />
      </t-form-item>
      <t-form-item label="Y" name="y">
        <t-input-number v-model="rect.y" @change="changeRect('y')" />
      </t-form-item>
      <t-form-item label="宽" name="width">
        <t-input-number v-model="rect.width" @change="changeRect('width')" />
      </t-form-item>
      <t-form-item label="高" name="height">
        <t-input-number v-model="rect.height" @change="changeRect('height')" />
      </t-form-item>

      <t-divider />

      <t-form-item label="文字水平对齐" name="textAlign">
        <t-select v-model="pen.textAlign" @change="changeValue('textAlign')">
          <t-option key="left" value="left" label="左对齐"></t-option>
          <t-option key="center" value="center" label="居中"></t-option>
          <t-option key="right" value="right" label="右对齐"></t-option>
        </t-select>
      </t-form-item>
      <t-form-item label="文字垂直对齐" name="textBaseline">
        <t-select
          v-model="pen.textBaseline"
          @change="changeValue('textBaseline')"
        >
          <t-option key="top" value="top" label="顶部对齐"></t-option>
          <t-option key="middle" value="middle" label="居中"></t-option>
          <t-option key="bottom" value="bottom" label="底部对齐"></t-option>
        </t-select>
      </t-form-item>

      <t-divider />

      <t-space>
        <t-button @click="top">置顶</t-button>
        <t-button @click="bottom">置底</t-button>
        <t-button @click="up">上一层</t-button>
        <t-button @click="down">下一层</t-button>
      </t-space>
    </t-form>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useSelection } from '@/services/selections';

const { selections } = useSelection();

const pen = ref<any>();
// 位置数据。当前版本位置需要动态计算获取
const rect = ref<any>();

onMounted(() => {
  getPen();
});

const getPen = () => {
  pen.value = selections.pen;
  if (pen.value.globalAlpha == undefined) {
    pen.value.globalAlpha = 1;
  }

  rect.value = meta2d.getPenRect(pen.value);
};

// 监听选中不同图元
// @ts-ignore
const watcher = watch(() => selections.pen.id, getPen);

const lineDashs = [undefined, [5, 5]];

const changeValue = (prop: string) => {
  const v: any = { id: pen.value.id };
  v[prop] = pen.value[prop];
  if (prop === 'dash') {
    v.lineDash = lineDashs[v[prop]];
  }
  meta2d.setValue(v, { render: true });
};

const changeRect = (prop: string) => {
  const v: any = { id: pen.value.id };
  v[prop] = rect.value[prop];
  meta2d.setValue(v, { render: true });
};

const top = () => {
  meta2d.top();
  meta2d.render();
};
const bottom = () => {
  meta2d.bottom();
  meta2d.render();
};
const up = () => {
  meta2d.up();
  meta2d.render();
};
const down = () => {
  meta2d.down();
  meta2d.render();
};

onUnmounted(() => {
  watcher();
});
</script>
<style lang="postcss" scoped>
.props-panel {
  :deep(.t-form) {
    .t-form__item {
      margin-bottom: 8px;
    }
    .t-form__label {
      padding-right: 8px;
    }

    .t-divider {
      margin: 12px 0;
    }

    .t-input--auto-width {
      width: 100%;
    }

    .t-space {
      gap: 4px;
    }
  }
}
</style>
