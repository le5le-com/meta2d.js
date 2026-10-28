<template>
  <div class="graphics-container">
    <div @dragover.prevent class="graphics-panel">
      <t-collapse v-model="activeLib">
        <t-collapse-panel
          :value="item.name"
          v-for="item in filteredShapes"
          :key="item.name"
          :header="item.name"
          v-show="item.visible !== false"
        >
          <template v-for="elem in item.list">
            <div
              v-if="elem.visible !== false"
              class="graphic"
              draggable="true"
              @dragstart="dragStart($event, elem)"
              @click.stop="dragStart($event, elem)"
              @touchstart.passive="dragStart($event, elem)"
              @dragend="dragEnd"
            >
              <t-image v-if="!elem.svg && elem.image" :src="elem.image" :lazy="true" fit="contain" />
              <div class="svg-box" v-else-if="elem.svg" v-html="elem.svg" />
              <svg v-else class="l-icon" aria-hidden="true">
                <use :xlink:href="'#' + elem.icon"></use>
              </svg>
              <p :title="$t(elem.name)">{{ $t(elem.name) }}</p>
            </div>
          </template>
          <div v-if="!item.list || !item.list.length" class="gray" style="white-space: nowrap; margin-left: 36px">
            {{ $t('暂无数据') }}
          </div>
        </t-collapse-panel>
      </t-collapse>
    </div>
    <div class="graphics-footer">
      <t-button theme="primary" style="height: 26px">
        {{ $t('更多图形') }}
      </t-button>
    </div>
  </div>

  <div id="dragImage">
    <t-image v-if="!dragElem.svg && dragElem.image" :src="dragElem.image" fit="contain" />
    <div class="svg-box" v-else-if="dragElem.svg" v-html="dragElem.svg" />
    <svg v-else-if="dragElem.icon" class="l-icon" aria-hidden="true">
      <use :xlink:href="'#' + dragElem.icon"></use>
    </svg>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch, toRaw } from 'vue';
import { shapes } from './services/shapes';
import { Meta2d } from '@meta2d/core';
import { debounce } from '../../services/debouce';
const props = defineProps<{
  keyWord: string;
}>();
const dragElem = ref<any>({});
let dragImage: any;
onMounted(() => {
  dragImage = document.getElementById('dragImage');

  const timer = setInterval(() => {
    meta2d = document.querySelector('le5le-meta2d') as Meta2d;
    if (meta2d) {
      clearInterval(timer);
    }
  }, 100);
});
const activeLib = ref<string[]>(['常用图形', '基本形状']);

let meta2d: Meta2d;

const dragStart = (event: DragEvent | MouseEvent | TouchEvent, elem: any) => {
  event.stopPropagation();

  dragElem.value = elem;

  if (event instanceof DragEvent) {
    event.dataTransfer?.setData('Meta2d', JSON.stringify(elem.data));

    event.dataTransfer?.setDragImage(dragImage, 16, 16);
  }

  const pen = structuredClone(toRaw(elem.data));
  pen.x = -pen.width / 2;
  pen.y = -pen.height / 2;
  meta2d.addCaches = [pen];
};

const dragEnd = () => {
  meta2d.dragEnd();
};

const filteredShapes = ref<any[]>(shapes);
watch(
  () => props.keyWord,
  () => {
    debounce(handleSearch, 500);
  }
);
const handleSearch = () => {
  filteredShapes.value = [];
  for (let classify of shapes) {
    const filterClassify = { ...classify, list: [] };
    for (let shape of classify.list) {
      if (shape.name.includes(props.keyWord)) {
        filterClassify.list.push(shape);
      }
    }
    if (filterClassify.list.length > 0) {
      filteredShapes.value.push(filterClassify);
    }
  }
};
</script>
<style lang="postcss" scoped>
.graphics-container {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  .graphics-panel {
    flex: 1;
    overflow: auto;

    :deep(.t-collapse) {
      .t-collapse-panel__content {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        grid-row-gap: 12px;

        .graphic {
          position: relative;
          padding: 10px 0;
          border-radius: 2px;
          border: 1px solid transparent;

          &:hover {
            cursor: pointer;
            border-color: var(--color-primary);
          }
          p {
            margin-top: 5px;
            padding: 0 8px;
            text-align: center;
            font-size: 12px;
            height: 12px;
            line-height: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 1;
            line-clamp: 1;
            -webkit-box-orient: vertical;
            word-break: break-all;
          }
          .t-image__wrapper {
            height: 32px;
            width: 32px;
            margin: auto;
            .t-image {
              border-radius: 2px;
            }
          }

          svg {
            color: var(--color);
            height: 32px;
            width: 100%;
            margin: auto;
          }

          .svg-box {
            height: 32px;
            width: 100%;
            margin: auto auto 12px auto;
            svg {
              height: 100%;
              width: 100%;
            }
          }
        }
      }
    }
  }
  .graphics-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 0;
    margin-bottom: 12px;
    border-top: 1px solid #e5e5e5;
    flex-shrink: 0;
  }
}

#dragImage {
  position: absolute;
  top: -1000px;
  left: -1000px;
  width: 32px;
  height: 32px;
  opacity: 0;

  & > * {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
}
</style>
