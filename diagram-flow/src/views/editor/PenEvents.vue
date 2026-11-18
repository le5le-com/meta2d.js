<template>
  <div class="props">
    <div v-if="pen.events?.length">
      <t-collapse
        v-model="openedCollapses"
        :borderless="true"
        :expand-on-row-click="true"
        expand-icon-placement="left"
      >
        <t-collapse-panel v-for="(item, i) in pen.events" :value="i">
          <template #header>
            <div @click.stop class="head flex">
              <t-select v-model="item.type" style="width: 40%" :options="options" autoWidth />
              <t-input
                v-if="item.type === EventType.Message"
                style="width: 93px; margin-left: 20px"
                v-model="item.message"
                :placeholder="$t('消息名')"
              />
            </div>
          </template>
          <template #headerRightContent>
            <t-space size="small" @click.stop>
              <t-popconfirm
                placement="left"
                @confirm="pen.events.splice(i, 1)"
                :content="$t('确认删除该交互事件吗？')"
              >
                <delete-icon class="hover" />
              </t-popconfirm>
            </t-space>
          </template>
          <Actions :data="pen.events[i]" />
        </t-collapse-panel>
      </t-collapse>
      <t-divider />
      <div class="p-16">
        <t-dropdown :options="options" @click="addEvent" :minColumnWidth="254" :maxHeight="360">
          <t-button class="w-full" style="height: 30px">
            {{ $t('添加交互事件') }}
          </t-button>
        </t-dropdown>
      </div>
    </div>
    <div class="flex column center blank" v-else>
      <div class="gray center">{{ $t('还没有交互事件') }}</div>
      <div class="mt-8">
        <t-dropdown :options="options" @click="addEvent" :minColumnWidth="150" :maxHeight="360">
          <t-button style="height: 30px"> {{ $t('添加交互事件') }} </t-button>
        </t-dropdown>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeMount, ref, toRaw, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { DeleteIcon } from 'tdesign-icons-vue-next';
import { EventType, Meta2d, Mode } from '@meta2d/core';
import Actions from './Actions.vue';
import { useSelection } from './services/selections';

const { t } = useI18n();
const { selections } = useSelection();
const { pen } = toRefs(selections) as any;

// 选择框读取 label，下拉菜单读取 content，两者取相同文案
const options = [
  { value: EventType.Click, label: t('单击') },
  { value: EventType.Dblclick, label: t('双击'), divider: true },
  { value: EventType.Contextmenu, label: t('鼠标右键') },
  { value: EventType.Enter, label: t('鼠标移入') },
  { value: EventType.Leave, label: t('鼠标移出'), divider: true },
  { value: EventType.Active, label: t('获得焦点') },
  { value: EventType.Inactive, label: t('失去焦点'), divider: true },
  { value: EventType.Mousedown, label: t('鼠标按下') },
  { value: EventType.Mouseup, label: t('鼠标抬起'), divider: true },
  { value: EventType.Message, label: t('监听全局消息') },
].map((item) => ({ ...item, content: item.label }));

const openedCollapses = ref([0]);

onBeforeMount(() => {
  if (pen.value && !pen.value.events) {
    pen.value.events = [];
  }
});

// selections.pen 是克隆对象，事件配置变化后同步回画布；切换图元时不写入
watch(
  () => [pen.value?.id, pen.value?.events] as const,
  ([id, events], [previousId]) => {
    if (!id || id !== previousId) {
      return;
    }
    const meta2d = document.querySelector('le5le-meta2d') as unknown as Meta2d;
    meta2d.setValue({ id, events: toRaw(events) }, { mode: Mode.Edit });
  },
  { deep: true },
);

const addEvent = (e: { value: EventType }) => {
  if (!pen.value.events) {
    pen.value.events = [];
  }
  pen.value.events.push({ type: e.value, actions: [] });
};
</script>
<style lang="postcss" scoped>
.props {
  height: 100%;

  .blank {
    height: 70%;
  }

  .head {
    :deep(.t-select) {
      width: fit-content;

      .t-input {
        border-color: transparent;
      }
    }
  }
}
</style>
