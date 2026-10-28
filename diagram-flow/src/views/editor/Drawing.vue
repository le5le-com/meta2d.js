<template>
  <div class="drawing">
    <div class="tools">
      <t-tooltip :content="$t('新建')">
        <a @click="newFile">
          <add-icon />
        </a>
      </t-tooltip>
      <t-tooltip :content="$t('保存')">
        <a @click="save">
          <save-icon />
        </a>
      </t-tooltip>
      <t-tooltip :content="$t('撤销')">
        <a @click="undo">
          <RollbackIcon />
        </a>
      </t-tooltip>
      <t-tooltip :content="$t('重做')">
        <a @click="redo">
          <RollfrontIcon />
        </a>
      </t-tooltip>
      <t-tooltip :content="$t('格式刷（双击连续使用）')">
        <a
          @click="handleFormatBrush(FormatMode.ApplyOnce)"
          @dblclick="handleFormatBrush(FormatMode.ContinuousApply)"
          :class="{ active: formatMode !== FormatMode.None }"
        >
          <svg
            width="1em"
            height="1em"
            viewBox="0 0 256 256"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
          >
            <defs>
              <path id="77456364" d="M0 0h256v256H0z"></path>
            </defs>
            <g fill="none" fill-rule="evenodd">
              <mask id="3804093554b" fill="#fff">
                <use xlink:href="#77456364"></use>
              </mask>
              <path
                d="M213 77c0 14.36-11.64 26-26 26H69c-14.36 0-26-11.64-26-26V51c0-14.36 11.64-26 26-26h118c14.36 0 26 11.64 26 26v2h9.125c9.83 0 17.82 7.88 17.997 17.67l.003.33v50c0 9.83-7.88 17.82-17.67 17.997l-.33.003h-84.626v18H139c9.83 0 17.82 7.88 17.997 17.67l.003.33v35c0 16.016-12.984 29-29 29-15.856 0-28.74-12.725-28.996-28.52L99 210v-35c0-9.83 7.88-17.82 17.67-17.997L117 157h.499l.001-20c0-9.83 7.88-17.82 17.67-17.997l.33-.003h84.625V73H213Zm-76 100h-18v33a9 9 0 0 0 8.471 8.985l.264.011.265.004a9 9 0 0 0 8.996-8.735L137 210v-33Zm50-132H69a6 6 0 0 0-6 6v26a6 6 0 0 0 6 6h118a6 6 0 0 0 6-6V51a6 6 0 0 0-6-6Z"
                fill="currentColor"
                fill-rule="nonzero"
                mask="url(#3804093554b)"
              ></path>
            </g>
          </svg>
        </a>
      </t-tooltip>
      <t-tooltip :content="$t('清除格式')">
        <a @click="handleClearFormat">
          <ClearFormatting1Icon />
        </a>
      </t-tooltip>
      <span class="flex-grow"></span>
      <t-tooltip :content="$t('开始连线')">
        <a @click="startDrawLine" :class="{ active: drawLining }">
          <TrendingUpIcon />
        </a>
      </t-tooltip>
      <t-dropdown @click="changeLineType($event.value)" :minColumnWidth="120">
        <t-tooltip :content="$t('连线类型')">
          <a @click="">
            <svg class="l-icon" aria-hidden="true">
              <use v-if="lineType === 'curve'" xlink:href="#l-curve2"></use>
              <use v-else-if="lineType === 'orthogonal'" xlink:href="#l-polyline"></use>
              <use v-else xlink:href="#l-line"></use>
            </svg>
          </a>
        </t-tooltip>
        <t-dropdown-menu>
          <t-dropdown-item :value="'curve'">
            <a class="tools-dropdown">
              <svg class="l-icon mr-12" aria-hidden="true">
                <use xlink:href="#l-curve2"></use>
              </svg>
              {{ $t('曲线') }}
            </a>
          </t-dropdown-item>
          <t-dropdown-item :value="'orthogonal'">
            <a class="tools-dropdown">
              <svg class="l-icon mr-12" aria-hidden="true">
                <use xlink:href="#l-polyline"></use>
              </svg>
              {{ $t('正交线') }}
            </a>
          </t-dropdown-item>
          <t-dropdown-item :value="'line'">
            <a class="tools-dropdown">
              <svg class="l-icon mr-12" aria-hidden="true">
                <use xlink:href="#l-line"></use>
              </svg>
              {{ $t('直线') }}
            </a>
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
      <t-dropdown @click="changeLineArrow('fromArrow', $event.value)" :minColumnWidth="120">
        <t-tooltip :content="$t('起点箭头')">
          <a @click="">
            <svg class="l-icon" aria-hidden="true" style="width: 18px; height: 18px">
              <use :xlink:href="'#l-from-' + fromArrow"></use>
            </svg>
          </a>
        </t-tooltip>

        <t-dropdown-menu>
          <t-dropdown-item :value="''">
            <a class="arrow-dropdown">
              <svg class="l-icon" aria-hidden="true">
                <use xlink:href="#l-from-"></use>
              </svg>
            </a>
          </t-dropdown-item>
          <t-dropdown-item :value="'line'">
            <a class="arrow-dropdown">
              <svg class="l-icon" aria-hidden="true">
                <use xlink:href="#l-from-line"></use>
              </svg>
            </a>
          </t-dropdown-item>
          <t-dropdown-item :value="'triangle'">
            <a class="arrow-dropdown">
              <svg class="l-icon" aria-hidden="true">
                <use xlink:href="#l-from-triangle"></use>
              </svg>
            </a>
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
      <t-dropdown @click="changeLineArrow('toArrow', $event.value)" :minColumnWidth="120">
        <t-tooltip :content="$t('终点箭头')">
          <a @click="">
            <svg class="l-icon" aria-hidden="true" style="width: 18px; height: 18px">
              <use :xlink:href="'#l-to-' + toArrow"></use>
            </svg>
          </a>
        </t-tooltip>

        <t-dropdown-menu>
          <t-dropdown-item :value="''">
            <a class="arrow-dropdown">
              <svg class="l-icon" aria-hidden="true">
                <use xlink:href="#l-to-"></use>
              </svg>
            </a>
          </t-dropdown-item>
          <t-dropdown-item :value="'line'">
            <a class="arrow-dropdown">
              <svg class="l-icon" aria-hidden="true">
                <use xlink:href="#l-to-line"></use>
              </svg>
            </a>
          </t-dropdown-item>
          <t-dropdown-item :value="'triangle'">
            <a class="arrow-dropdown">
              <svg class="l-icon" aria-hidden="true">
                <use xlink:href="#l-to-triangle"></use>
              </svg>
            </a>
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>

      <t-tooltip :content="$t('连线颜色')">
        <a @click="openColorPicker('color', $event)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -900 900 900" style="width: 14px; height: 14px">
            <path
              d="M80 0v-160h800V0H80Zm160-320h56l312-311-29-29-28-28-311 312v56Zm-80 80v-170l448-447q11-11 25.5-17t30.5-6q16 0 31 6t27 18l55 56q12 11 17.5 26t5.5 31q0 15-5.5 29.5T777-687L330-240H160Zm560-504-56-56 56 56ZM608-631l-29-29-28-28 57 57Z"
            />
          </svg>
        </a>
      </t-tooltip>
      <t-tooltip :content="$t('背景颜色')">
        <a @click="openColorPicker('penBackground', $event)">
          <FillColorIcon />
        </a>
      </t-tooltip>
      <t-tooltip :content="$t('字体颜色')">
        <a @click="openColorPicker('textColor', $event)">
          <TextformatColorIcon />
        </a>
      </t-tooltip>
      <t-tooltip :content="$t('字体大小')">
        <t-input-number
          class="font-size-input"
          theme="normal"
          v-model="defaultData.fontSize"
          size="small"
          align="center"
          borderless
          :format="(value) => `${value}px`"
          style="width: 50px"
          @change="changeDefaultData('fontSize')"
        />
      </t-tooltip>

      <span class="flex-grow"></span>
      <t-tooltip :content="$t('视图缩放')">
        <div style="width: auto; padding: 0 5px; user-select: none">
          <span>{{ Math.round(scale * 100) }}%</span>
        </div>
      </t-tooltip>
      <t-tooltip :content="$t('重置视图')">
        <a @click="resetView">
          <RefreshIcon />
        </a>
      </t-tooltip>
      <t-tooltip :content="$t(modeDesc[mode])">
        <a @click="changeMode()">
          <LockOffIcon v-if="mode" />
          <LockOnIcon v-else />
        </a>
      </t-tooltip>
      <t-tooltip :content="$t('运行（预览）')">
        <a @click="handlePreview">
          <DeltaIcon style="transform: rotate(180deg)" />
        </a>
      </t-tooltip>
    </div>
    <le5le-meta2d></le5le-meta2d>
    <t-color-picker-panel
      v-if="colorPickerVisible"
      format="CSS"
      :color-modes="['monochrome']"
      :recent-colors="null"
      class="color-picker-panel"
      :style="colorPickerStyle"
      v-model="currentColorValue"
      :show-primary-color-preview="false"
      @change="handleColorChange"
      :enable-alpha="true"
    />
    <ContextMenu />
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, computed, toRaw } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  AddIcon,
  SaveIcon,
  RollbackIcon,
  RollfrontIcon,
  ClearFormatting1Icon,
  TrendingUpIcon,
  FillColorIcon,
  TextformatColorIcon,
  RefreshIcon,
  DeltaIcon,
  LockOnIcon,
  LockOffIcon,
} from 'tdesign-icons-vue-next';
import { createMeta2d, Meta2d, Mode, AnchorMode, getBoundary } from '@meta2d/core';
import { useSelection } from './services/selections';
import ContextMenu from './components/ContextMenu.vue';
import { emitter } from './services/emitter';
import { defaultFormatAttrs } from './services/const';
import { debounce } from '../../services/debouce';
const enum FormatMode {
  None,
  ApplyOnce,
  ContinuousApply,
}
const { selections, select } = useSelection();

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

let meta2d: Meta2d;

onMounted(async () => {
  createMeta2d();

  meta2d = document.querySelector('le5le-meta2d') as any;
  meta2d.setMode(Mode.Edit);
  meta2d.setOptions({ rule: { enable: true } });
  meta2d.on('active', select);
  meta2d.on('scale', onScale);
  meta2d.on('active', aplyFormatAttrs);

  // 监听点击事件，用于关闭颜色选择器
  document.addEventListener('click', handleClickOutside);
  emitter.on('preview', handlePreview);
  emitter.on('formatBrush', () => {
    handleFormatBrush(FormatMode.ApplyOnce);
  });

  meta2d.register(npmUrl('@meta2d/echarts'));
  meta2d.register(npmUrl('@meta2d/uml'));

  // 下面主要用于打包，避免包被树摇掉。如果是url地址则跳过
  import('@meta2d/echarts');
  import('@meta2d/uml');
});

const npmUrl = (pkg: string): string => {
  // 开发阶段：映射到源码
  if (import.meta.env.DEV) {
    pkg = pkg.replaceAll('@meta2d/', '');
    return `/npm/${pkg}/index.ts`;
  }

  // 生产阶段：单独编译打包到dist/npm目录下
  return `/npm/${'@meta2d/echarts'.replace(/\//g, '_')}.js`;
};

const newFile = () => {
  emitter.emit('new');
};

const save = () => {
  emitter.emit('save');
};

const undo = () => {
  emitter.emit('undo');
};

const redo = () => {
  emitter.emit('redo');
};

let formatAttrs: any = null;
const formatMode = ref(FormatMode.None);

const handleFormatBrush = (curFormatMode: FormatMode) => {
  debounce(formatBrushFn, 300, { curFormatMode });
};

const formatBrushFn = (params: { curFormatMode: FormatMode }) => {
  const { curFormatMode } = params;
  const activePens = meta2d.activePens;
  if (!activePens || activePens.length === 0) {
    MessagePlugin.warning('请先选择一个元素作为格式源');
    return;
  } else if (activePens.length > 1) {
    MessagePlugin.warning('请只选择一个元素作为格式源');
    return;
  }
  if (formatMode.value !== FormatMode.None) {
    formatMode.value = FormatMode.None;
    return;
  }
  formatMode.value = curFormatMode;
  const sourcePen = activePens[0];
  formatAttrs = {};
  for (const key of defaultFormatAttrs) {
    if (sourcePen[key] !== undefined || sourcePen[key] !== null) {
      formatAttrs[key] = sourcePen[key];
    }
  }
  MessagePlugin.success('格式已复制，点击其他元素应用格式');
};

const aplyFormatAttrs = (pens: any[]) => {
  if (formatMode.value === FormatMode.None || !formatAttrs || !pens.length) {
    return;
  }

  for (const pen of pens) {
    const updateProps: any = structuredClone(formatAttrs);
    meta2d.setValue({ ...updateProps, id: pen.id });
  }

  if (formatMode.value === FormatMode.ApplyOnce) {
    formatMode.value = FormatMode.None;
    formatAttrs = null;
    MessagePlugin.success('格式已应用');
  } else {
    MessagePlugin.success('格式已应用，继续点击其他元素应用格式');
  }
};

const handleClearFormat = () => {
  const activePens = meta2d.activePens;
  if (!activePens || activePens.length === 0) {
    MessagePlugin.warning('请先选择要清除格式的元素');
    return;
  }
  // 应用到所有选中的元素
  for (const pen of activePens) {
    const updateProps: any = { id: pen.id };
    for (const key of defaultFormatAttrs) {
      if (pen[key] !== undefined || pen[key] !== null) {
        updateProps[key] = undefined;
      }
    }
    meta2d.setValue(updateProps);
  }
  MessagePlugin.success('格式已清除');
};

const drawLining = ref(false);
const startDrawLine = () => {
  const anchorMode = meta2d.options?.anchorMode || AnchorMode.Hidden;
  if (drawLining.value) {
    // 关闭连线模式
    meta2d.setOptions({ anchorMode: anchorMode & ~AnchorMode.Drawline });
    drawLining.value = false;
  } else {
    // 开启连线模式
    meta2d.setOptions({ anchorMode: anchorMode | AnchorMode.Drawline });
    drawLining.value = true;
  }
};

const lineType = ref('curve');
const changeLineType = (value: string) => {
  lineType.value = value;
  meta2d.setLineType(value);
};

const fromArrow = ref('');
const toArrow = ref('');
const changeLineArrow = (key: string, value: string) => {
  if (key === 'fromArrow') {
    fromArrow.value = value;
  } else {
    toArrow.value = value;
  }
  meta2d.setOptions({ [key]: value });
};

const colorPickerVisible = ref(false);
const currentColorKey = ref<string>('');
const triggerElement = ref<HTMLElement | null>(null);

const currentColorValue = computed({
  get: () => {
    return defaultData.value[currentColorKey.value] || '';
  },
  set: (value: string) => {
    if (currentColorKey.value) {
      defaultData.value[currentColorKey.value] = value;
    }
  },
});
const colorPickerStyle = computed(() => {
  if (!triggerElement.value || !colorPickerVisible.value) {
    return { left: '0px', top: '0px' };
  }
  const rect = triggerElement.value.getBoundingClientRect();

  const left = rect.left + rect.width + 10;
  const top = rect.top;

  return {
    left: `${left}px`,
    top: `${top}px`,
  };
});

const defaultData = ref({
  penBackground: '',
  textColor: '',
  color: '',
  fontSize: 12,
});

const changeDefaultData = (key: string) => {
  meta2d.setPageConfig({ [key]: defaultData.value[key] });
};

const openColorPicker = (key: string, event: MouseEvent) => {
  currentColorKey.value = key;
  triggerElement.value = event.currentTarget as HTMLElement;
  colorPickerVisible.value = true;
};

const handleColorChange = (value: string) => {
  if (currentColorKey.value) {
    defaultData.value[currentColorKey.value] = value;
    changeDefaultData(currentColorKey.value);
  }
};

const handleClickOutside = (event: MouseEvent) => {
  if (colorPickerVisible.value && triggerElement.value) {
    const target = event.target as HTMLElement;
    if (!triggerElement.value.contains(target) && !target.closest('.color-picker-panel')) {
      colorPickerVisible.value = false;
      triggerElement.value = null;
    }
  }
};

const scale = ref(1);
const onScale = (curScale: number) => {
  scale.value = curScale;
};

const resetView = () => {
  emitter.emit('resetView');
};

const mode = ref(Mode.Edit);
const modeDesc = ['运行模式', '编辑模式'];
const changeMode = () => {
  mode.value = mode.value === Mode.Edit ? Mode.Run : Mode.Edit;
  meta2d.setMode(mode.value);
};

const handlePreview = async () => {
  const name = route.query.name as string;
  if (!name) {
    MessagePlugin.warning(t('请先保存文件'));
    return;
  }

  try {
    const data = meta2d.data;
    let width = data.width;
    let height = data.height;
    if (!width || !height) {
      const boundingBox = getBoundary(data.pens, meta2d.textBoxs);
      width = boundingBox.width;
      height = boundingBox.height;
    }
    const windowSize = {
      width: window.screen.availWidth * 0.9,
      height: window.screen.availHeight * 0.9,
    };
    const scale = Math.min(windowSize.height / height, windowSize.width / width);
    windowSize.width = width * scale;
    windowSize.height = height * scale;

    const previewUrl = `/view?name=${encodeURIComponent(name)}`;

    const features = [
      `width=${windowSize.width}`,
      `height=${windowSize.height}`,
      'resizable=yes',
      'scrollbars=yes',
      'toolbar=no',
      'menubar=no',
      'location=no',
    ].join(',');

    window.open(previewUrl, '_blank', features);
  } catch (error) {
    console.error('Preview error:', error);
    MessagePlugin.error(t('预览失败：') + (error as Error).message);
  }
};

onBeforeUnmount(() => {
  meta2d.off('active', select);
  meta2d.off('active', aplyFormatAttrs);
  document.removeEventListener('click', handleClickOutside);
});
</script>
<style lang="postcss" scoped>
.drawing {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  .color-picker-panel {
    position: absolute;
    z-index: 1000;
  }
  .tools {
    height: 40px;
    display: flex;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid var(--color-border);

    a {
      display: flex;
      width: 26px;
      height: 26px;
      align-items: center;
      justify-content: center;
      color: var(--color);
      font-size: 16px;
      border-radius: 4px;
      margin: 0 4px;
      text-decoration: none;

      &:hover,
      &.active {
        background-color: #ddd;
      }

      svg {
        color: #3e3f3f;
        width: 16px;
        height: 16px;
      }

      span {
        font-size: 13px;
      }
    }
  }
}

.tools-dropdown {
  display: flex !important;
  align-items: center;
  svg {
    width: 16px;
    height: 16px;
  }
}

.arrow-dropdown {
  display: flex !important;
  align-items: center;
  height: 30px;
  svg {
    width: 24px;
    height: 24px;
  }
}

.font-size-input {
  :deep(.t-input) {
    border: none;
    background: none;
    &:hover,
    &:focus {
      background-color: #fff;
    }
  }
}
</style>
