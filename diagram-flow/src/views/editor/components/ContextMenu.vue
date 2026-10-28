<template>
  <t-menu v-show="visible" ref="menuRef" class="context-menu" :style="menuStyle">
    <template v-for="item in menuItems" :key="item.key">
      <t-menu-item :disabled="item.disabled" :value="item.key" @click="handleAction(item)">
        {{ item.label }}
      </t-menu-item>
      <t-divider v-if="item.divider" />
    </template>
  </t-menu>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Meta2d } from '@meta2d/core';
import { useSelection, SelectionMode } from '../services/selections';

const { t } = useI18n();
const { selections, select } = useSelection();

const visible = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const x = ref(0);
const y = ref(0);
let meta2d: Meta2d;

onMounted(() => {
  const timer = setInterval(() => {
    const instance = document.querySelector('le5le-meta2d') as any;
    if (instance) {
      meta2d = instance;
      clearInterval(timer);
      if (meta2d) {
        meta2d.onContextMenu = onContextMenu;
      }
    }
  }, 50);
});

onUnmounted(() => {
  if (meta2d) {
    (meta2d as any).onContextMenu = null;
  }
});

const menuItems = computed(() => {
  const items: any[] = [
    { key: 'up', label: t('上移一层'), disabled: false },
    { key: 'down', label: t('下移一层'), disabled: false },
    { key: 'top', label: t('置顶'), disabled: false },
    { key: 'bottom', label: t('置底'), divider: true, disabled: false },
    { key: 'cut', label: t('剪切'), disabled: false },
    { key: 'copy', label: t('复制'), disabled: false },
    { key: 'paste', label: t('粘贴'), disabled: false },
    { key: 'delete', label: t('删除'), divider: true, disabled: false },
    { key: 'undo', label: t('撤销'), disabled: false },
    { key: 'redo', label: t('重做'), disabled: false },
  ];
  const mode = selections.mode;

  if (mode === SelectionMode.File) {
    items.forEach((item) => {
      item.key !== 'paste' && (item.disabled = true);
    });
  } else {
    let index = items.findIndex((item) => item.key === 'cut');
    const pen = selections.pen;
    const pens = selections.pens;

    if (mode === SelectionMode.Pen && pen?.type === 'group') {
      items.splice(index++, 0, { key: 'ungroup', label: t('解除组合'), disabled: false });
    } else if (mode === SelectionMode.Pens) {
      items.splice(index++, 0, { key: 'group', label: t('组合'), disabled: false });
    }

    if (pen?.locked || pens?.every((p) => p.locked)) {
      items.splice(index++, 0, { key: 'unlock', label: t('解锁'), disabled: false });
    } else {
      items.splice(index++, 0, { key: 'lock', label: t('锁定'), disabled: false });
    }

    if (pen?.visible === false || pens?.every((p) => p.visible === false)) {
      items.splice(index++, 0, { key: 'show', label: t('显示'), disabled: false, divider: true });
    } else {
      items.splice(index++, 0, { key: 'hide', label: t('隐藏'), disabled: false, divider: true });
    }
  }
  return items;
});

const menuStyle = computed(() => ({
  left: `${x.value}px`,
  width: '180px',
  top: `${y.value}px`,
}));

const handleAction = (item: any) => {
  if (!meta2d) return;
  switch (item.key) {
    case 'paste':
      meta2d.onPaste();
      break;
    case 'lock':
      lockPens(true);
      break;
    case 'unlock':
      lockPens(false);
      break;
    case 'show':
      hidePens(true);
      break;
    case 'hide':
      hidePens(false);
      break;
    case 'delete':
      meta2d.deletePens(meta2d.activePens);
      break;
    case 'undo':
      meta2d.undo();
      break;
    case 'redo':
      meta2d.redo();
      break;
    case 'cut':
      meta2d.onCut();
      break;
    case 'copy':
      meta2d.onCopy();
      break;
    case 'up':
      meta2d.moveLayer(true);
      break;
    case 'down':
      meta2d.moveLayer(false);
      break;
    case 'top':
      meta2d.toFrontOrBack(true);
      break;
    case 'bottom':
      meta2d.toFrontOrBack(false);
      break;
    case 'ungroup':
      meta2d.ungroup(meta2d.activePens);
      break;
    case 'group':
      meta2d.group(meta2d.activePens);
      break;
    case 'combine-state':
      // Assuming combine takes a generic second argument or name for creating specific types
      // (meta2d as any).combine(selections.pens, 'state');
      break;
  }
  visible.value = false;
};

const onContextMenu = (e: MouseEvent, show: boolean) => {
  e.preventDefault();
  e.stopPropagation();
  x.value = e.clientX;
  visible.value = show;
  nextTick(() => {
    const menuHeight = (menuRef.value as any)?.$el?.offsetHeight;
    const spaceBelow = window.innerHeight - e.clientY;
    y.value = spaceBelow > menuHeight ? e.clientY : window.innerHeight - menuHeight;
  });
};

const lockPens = (locked: boolean) => {
  const pens = selections.mode === SelectionMode.Pens ? selections.pens : [selections.pen];
  if (!pens.length) return;
  const vals = [];
  pens.forEach((p: any) => {
    vals.push({ id: p.id, locked });
    p.locked = locked;
  });
  meta2d.setValue(vals);
};

const hidePens = (visible: boolean) => {
  const pens = selections.mode === SelectionMode.Pens ? selections.pens : [selections.pen];
  if (!pens.length) return;
  const vals = [];
  pens.forEach((p: any) => {
    p.visible = visible;
    vals.push({ id: p.id, visible });
  });
  meta2d.setValue(vals);
};
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  box-shadow: var(--shadow);
  :deep(.t-menu__item) {
    line-height: 1.5;
    height: 28px;
  }
}
</style>
