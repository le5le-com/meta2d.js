<template>
  <div class="props">
    <div v-if="pen.events.length">
      <t-collapse
        v-model="openedCollapses"
        :borderless="true"
        :expand-on-row-click="true"
        expand-icon-placement="left"
      >
        <t-collapse-panel v-for="(item, i) in pen.events" :value="i">
          <template #header>
            <div @click.stop class="head flex">
              <t-select
                v-model="item.name"
                style="width: 40%"
                @change="eventNameChange"
                :options="options"
                autoWidth
              />
              <t-input
                v-if="item.name === 'message'"
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
          <!-- <Conditions :data="pen.events[i]" /> -->
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
import { onBeforeMount, onUnmounted, ref, computed, getCurrentInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import Actions from './Actions.vue';
// import Conditions from './Conditions.vue';
import { DeleteIcon } from 'tdesign-icons-vue-next';
const { t } = useI18n();
const props = defineProps<{
  pen: any;
}>();
const options: any = [
  {
    value: 'click',
    content: t('单击'),
  },
  {
    value: 'dblclick',
    content: t('双击'),
    divider: true,
  },
  {
    value: 'contextmenu',
    content: t('鼠标右键'),
  },
  {
    value: 'enter',
    content: t('鼠标移入'),
  },
  {
    value: 'leave',
    content: t('鼠标移出'),
    divider: true,
  },
  {
    value: 'active',
    content: t('获得焦点'),
  },
  {
    value: 'inactive',
    content: t('失去焦点'),
    divider: true,
  },
  {
    value: 'mousedown',
    content: t('鼠标按下'),
  },
  {
    value: 'mouseup',
    content: t('鼠标抬起'),
    divider: true,
  },
  {
    value: 'message',
    content: t('监听全局消息'),
  },
];

const openedCollapses = ref([0]);

onBeforeMount(() => {
  if (!props.pen.events) {
    props.pen.events = [];
  }

  for (const item of options) {
    item.label = item.content;
  }
});

const addEvent = (e: any) => {
  props.pen.events.push({ name: e.value });
  if (props.pen.name === 'echarts') {
    // initEvent(props.pen);
  }
};

const eventNameChange = () => {
  if (props.pen.name === 'echarts') {
    // initEvent(props.pen);
  }
};

onUnmounted(() => {});
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
