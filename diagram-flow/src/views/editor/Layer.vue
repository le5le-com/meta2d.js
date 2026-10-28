<template>
  <t-tree
    :data="treeData"
    :keys="{ value: 'id', label: 'name' }"
    :hover="true"
    activable
    activeMultiple
    checkStrictly
    expandParent
    v-model:expanded="expandedKeys"
    :actived="activedKeys"
    class="layer-tree"
    :filter="filterTreeData"
  >
    <template #label="{ node }">
      <div class="flex middle node-label" @click="handleActive(node.data.id)">
        <ControlPlatformIcon class="mr-4" />
        <t-input
          v-model="node.data.label"
          v-if="node.data.editing"
          @enter="renamePen(node.data)"
          @blur="renamePen(node.data)"
          ref="renameInputRef"
        ></t-input>
        <span v-else @dblclick="handleRename(node.data)">{{ node.data.label }}</span>
      </div>
    </template>
    <template #operations="{ node }">
      <span class="mr-4" @click="handleLock(node.data)">
        <LockOnIcon v-if="node.data.locked" />
        <LockOffIcon v-else />
      </span>
      <span class="mr-4" @click="handleVisible(node.data)">
        <BrowseIcon v-if="node.data.visible" />
        <BrowseOffIcon v-else />
      </span>
    </template>
    <template #empty>
      <t-empty description="暂无数据" />
    </template>
  </t-tree>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, onUnmounted, nextTick } from 'vue';
import { ControlPlatformIcon, LockOnIcon, LockOffIcon, BrowseIcon, BrowseOffIcon } from 'tdesign-icons-vue-next';
import { Meta2d, Pen } from '@meta2d/core';
import { emitter } from './services/emitter';
import { MessagePlugin } from 'tdesign-vue-next';
interface TreeNode {
  label: string;
  id: string;
  children?: TreeNode[];
  tooltip?: string;
  penType?: string;
  locked?: boolean;
  visible?: boolean;
  editing?: boolean;
}

interface PenTreeProps {
  // 需要展示的图元数据,如果不传则默认展示所有图元
  pens?: any[];
  keyWord: string;
}
const props = withDefaults(defineProps<PenTreeProps>(), {
  pens: undefined,
});

let meta2d: Meta2d | null = null;
const treeData = ref<TreeNode[]>([]);
const expandedKeys = ref<string[]>([]);
onMounted(() => {
  const timer = setInterval(() => {
    const instance = document.querySelector('le5le-meta2d') as Meta2d;
    if (instance) {
      meta2d = instance;
      clearInterval(timer);
    }
    const pens = props.pens || Array.from(meta2d?.penMap.values() || []);
    const rootPens = pens.filter((pen) => !pen.parentId);

    if (rootPens.length > 0) {
      treeData.value = rootPens.map((pen) => buildTreeData(pen));
    }
    meta2d?.on('active', onActive);
    onActive(meta2d?.activePens || []);
  }, 50);
  emitter.on('expandAll', handleExpandAll);
  emitter.on('renamePen', handleRename);

});

onUnmounted(() => {
  emitter.off('expandAll', handleExpandAll);
  emitter.off('renamePen', handleRename);
  meta2d.off('active', onActive);
});

const buildTreeData = (pen: any): TreeNode => {
  const node: TreeNode = {
    label: pen.name || pen.type,
    id: pen.id,
    tooltip: `ID: ${pen.id}${pen.name ? `\n名称: ${pen.name}` : ''}${pen.type ? `\n类型: ${pen.type}` : ''}`,
    penType: pen.type,
    locked: pen.locked,
    visible: pen.visible || true,
  };

  if (pen.children && pen.children.length > 0) {
    node.children = [];
    pen.children.forEach((childId: string) => {
      const childPen = meta2d?.penMap.get(childId);
      if (childPen) {
        node.children!.push(buildTreeData(childPen));
      }
    });
  }

  return node;
};

const handleLock = (data: TreeNode) => {
  data.locked = !data.locked;
  meta2d.setValue({ id: data.id, locked: data.locked });
};

const handleVisible = (data: TreeNode) => {
  data.visible = !data.visible;
  meta2d.setValue({ id: data.id, visible: data.visible });
};

const renameInputRef = ref<HTMLInputElement | null>(null);
const handleRename = (data: TreeNode) => {
  let id = data?.id;
  if(!id) {
    if(meta2d?.activePens.length > 1) {
      MessagePlugin.warning('请选择单个图元进行重命名');
      return;
    }
    id = meta2d?.activePens[0].id;
  }
  const node = findNodeById(treeData.value, id);
  if (node) {
    node.editing = true;
    nextTick(() => {
      renameInputRef.value?.focus();
    });
  }
};

const findNodeById = (nodes: TreeNode[], id: string): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

const renamePen = (data: TreeNode) => {
  data.editing = false;
  meta2d.setValue({ id: data.id, name: data.label });
};

const filterTreeData = computed(() => {
  return props.keyWord ? (node) => node.data.label.includes(props.keyWord) : null;
});

const handleExpandAll = () => {
  const rootIds = treeData.value.map(node => node.id);
  const hasExpandedRoot = rootIds.some(id => expandedKeys.value.includes(id));

  if (hasExpandedRoot) {
    expandedKeys.value = [];
  } else {
    expandedKeys.value = getExpandableNodeIds(treeData.value);
  }
};

const getExpandableNodeIds = (nodes: TreeNode[]): string[] => {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      ids.push(node.id);
      ids.push(...getExpandableNodeIds(node.children));
    }
  }
  return ids;
};

const activedKeys = ref<string[]>([]);
const handleActive = (id:string) => {
  let pens: Pen[] = [meta2d?.penMap.get(id)];
  for(let activeId of activedKeys.value) {
    if(activeId !== id) {
      pens.push(meta2d?.penMap.get(activeId));
    } else {
      pens.shift();
    }
  }

  if(pens.length > 0) {
    meta2d?.active(pens);
  } else {
    meta2d?.clearActive();
  }
};

const onActive = (pens: Pen[]) => {
  if(pens.length === 0) {
    activedKeys.value = [];
    return;
  }

  activedKeys.value = pens.map((pen) => pen.id);
  for(let pen of pens) {
    const childrenIds = getAllChildrenIds(pen);
    activedKeys.value.push(...childrenIds);
  }
};

const getAllChildrenIds = (pen: Pen): string[] => {
  const ids: string[] = [];
  if (pen.children && pen.children.length > 0) {
    for (const childId of pen.children) {
      ids.push(childId);
      const childPen = meta2d?.penMap.get(childId);
      if (childPen) {
        ids.push(...getAllChildrenIds(childPen));
      }
    }
  }
  return ids;
};

</script>

<style lang="postcss" scoped>
.layer-tree {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding-block: 12px;

  &:deep(.t-tree__empty) {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}
</style>
