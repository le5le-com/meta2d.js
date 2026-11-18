<template>
  <div class="props">
    <div v-for="(a, index) in data.actions" class="mb-12">
      <div class="flex middle between" style="position: relative">
        <div class="flex middle">{{ $t('动作') }}{{ Number(index) + 1 }}</div>
        <close-icon class="hover" @click="data.actions.splice(index, 1)"></close-icon>
      </div>
      <div class="form-item mt-4">
        <label>{{ $t('动作类型') }}</label>
        <t-select v-model="a.type" @change="onChangeAction(a)" :placeholder="$t('请选择')">
          <t-option
            v-for="option in actionOptions"
            :key="option.value"
            :value="option.value"
            :label="$t(option.label)"
          ></t-option>
        </t-select>
      </div>

      <!-- 打开链接 -->
      <template v-if="a.type === PenActionType.Link">
        <div class="form-item mt-8">
          <label>{{ $t('链接地址') }}</label>
          <t-input v-model="a.payload.value" placeholder="URL"></t-input>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('打开方式') }}</label>
          <t-radio-group v-model="a.payload.params">
            <t-radio value="_blank">{{ $t('新页面') }}</t-radio>
            <t-radio value="_self">{{ $t('当前页面') }}</t-radio>
          </t-radio-group>
        </div>
      </template>

      <!-- 播放/暂停/停止动画 -->
      <template v-else-if="isAnimateAction(a.type)">
        <div class="form-item mt-8">
          <label>{{ $t('对象类型') }}</label>
          <t-radio-group v-model="a.targetType" @change="a.target = ''">
            <t-radio :value="TargetType.Pen">{{ $t('图元') }}</t-radio>
            <t-radio :value="TargetType.Tag">{{ $t('组') }}</t-radio>
          </t-radio-group>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('播放对象') }}</label>
          <t-tree-select
            v-if="a.targetType === TargetType.Pen"
            v-model="a.target"
            :data="penTree"
            filterable
            clearable
            @change="getAnimations(a.target)"
            @focus="getAnimations(a.target)"
            :placeholder="$t('默认自己')"
          ></t-tree-select>
          <t-select
            v-else
            v-model="a.target"
            :options="groups"
            @change="getAnimations(a.target)"
            @focus="getAnimations(a.target)"
            :placeholder="$t('组')"
          ></t-select>
        </div>
        <!-- 只有播放动画需要指定动画名称，暂停/停止作用于当前正在播放的动画 -->
        <div v-if="a.type === PenActionType.StartAnimate" class="form-item mt-8">
          <label>{{ $t('动画名称') }}</label>
          <t-select-input
            v-model:inputValue="a.payload.params"
            :value="a.payload.params"
            v-model:popupVisible="a.popupVisible"
            allow-input
            clearable
            @clear="a.payload.params = undefined"
            @focus="a.popupVisible = true"
            @blur="a.popupVisible = false"
            :placeholder="$t('缺省第一个动画')"
          >
            <template #panel>
              <ul style="padding: 8px 12px">
                <li
                  v-for="item in animations"
                  :key="item"
                  @click="
                    a.payload.params = item;
                    a.popupVisible = false;
                  "
                >
                  {{ item }}
                </li>
              </ul>
            </template>
          </t-select-input>
        </div>
      </template>

      <!-- 更改属性（不支持关联图元属性） -->
      <template v-else-if="a.type === PenActionType.SetProps">
        <div class="form-item mt-8">
          <label>{{ $t('对象类型') }}</label>
          <t-radio-group v-model="a.targetType" @change="a.target = ''">
            <t-radio :value="TargetType.Pen">{{ $t('图元') }}</t-radio>
            <t-radio :value="TargetType.Tag">{{ $t('组') }}</t-radio>
          </t-radio-group>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('更改对象') }}</label>
          <t-tree-select
            v-if="a.targetType === TargetType.Pen"
            v-model="a.target"
            :data="penTree"
            filterable
            clearable
            :placeholder="$t('默认自己')"
          />
          <t-select v-else v-model="a.target" :options="groups" :placeholder="$t('组')" clearable />
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('属性数据') }}</label>
          <div class="w-full">
            <div class="prop-grid head">
              <div>{{ $t('属性名') }}</div>
              <div>{{ $t('属性值') }}</div>
              <div class="right">
                <t-dropdown :min-column-width="160" @click="onAddValue(a, $event)">
                  <add-circle-icon class="hover" />
                  <t-dropdown-menu>
                    <t-dropdown-item key="custom" value="custom" :disabled="true" :divider="true" class="input">
                      <t-input
                        v-model="a.input"
                        style="pointer-events: auto"
                        :placeholder="$t('自定义')"
                        @enter="
                          onAddValue(a, { value: a.input });
                          a.input = '';
                        "
                      />
                    </t-dropdown-item>
                    <t-dropdown-item v-for="prop in cprops" :key="prop.value" :value="prop.value">
                      {{ prop.label }}
                    </t-dropdown-item>
                  </t-dropdown-menu>
                </t-dropdown>
              </div>
            </div>
            <template v-if="Object.keys(a.payload.value).length">
              <div class="prop-grid mt-8" v-for="(_, key) in a.payload.value" :key="key">
                <div class="ml-8 value-label">
                  <t-tooltip :content="String(key)">
                    {{ getPropDesc(String(key)) }}
                  </t-tooltip>
                </div>
                <t-input
                  :title="String(a.payload.value[key])"
                  v-model="a.payload.value[key]"
                  @change="valueChange(a.payload.value, String(key))"
                  :placeholder="$t('值')"
                  :autoWidth="false"
                />
                <delete-icon class="hover" @click="delete a.payload.value[key]" />
              </div>
            </template>
            <div v-else class="center gray mt-8">{{ $t('暂无数据') }}</div>
          </div>
        </div>
      </template>

      <!-- 播放/暂停/停止视频 -->
      <template v-else-if="isVideoAction(a.type)">
        <div class="form-item mt-8">
          <label>{{ $t('对象类型') }}</label>
          <t-radio-group v-model="a.targetType" @change="a.target = ''">
            <t-radio :value="TargetType.Pen">{{ $t('图元') }}</t-radio>
            <t-radio :value="TargetType.Tag">{{ $t('组') }}</t-radio>
          </t-radio-group>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('播放对象') }}</label>
          <t-tree-select
            v-if="a.targetType === TargetType.Pen"
            v-model="a.target"
            :data="penTree"
            filterable
            clearable
            :placeholder="$t('默认自己')"
          ></t-tree-select>
          <t-select v-else v-model="a.target" :options="groups" :placeholder="$t('组')"></t-select>
        </div>
      </template>

      <!-- 自定义函数 -->
      <template v-else-if="a.type === PenActionType.JS">
        <div class="form-item mt-8">
          <div class="w-full">
            <div>function javascriptFn(pen, params, context) {</div>
            <CodeEditor v-model="a.payload.value" class="mt-4" style="height: 200px" />
            <div class="mt-4">}</div>
          </div>
        </div>
      </template>

      <!-- 全局函数 -->
      <template v-else-if="a.type === PenActionType.GlobalFn">
        <div class="form-item mt-8">
          <label>{{ $t('函数名称') }}</label>
          <t-input v-model="a.payload.value" :placeholder="$t('函数名称')"></t-input>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('函数参数') }}</label>
          <t-input v-model="a.payload.params" :placeholder="$t('函数参数')"></t-input>
        </div>
      </template>

      <!-- 发送消息 -->
      <template v-else-if="a.type === PenActionType.Emit">
        <div class="form-item mt-8">
          <label>{{ $t('消息名称') }}</label>
          <t-input v-model.trim="a.payload.value" :placeholder="$t('名称')" />
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('消息参数') }}</label>
          <t-input v-model="a.payload.params" :placeholder="$t('参数')" />
        </div>
      </template>
    </div>
    <div class="mt-8">
      <a @click="data.actions.push({ payload: {} })"> + {{ $t('添加动作') }} </a>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeMount, ref } from 'vue';
import { CloseIcon, AddCircleIcon, DeleteIcon } from 'tdesign-icons-vue-next';
import { useI18n } from 'vue-i18n';
import { PenActionType, TargetType } from '@meta2d/core';
import { changeType, getGroups, getPenAnimations, getPenTree, type TreeNode } from './services/utils';
import CodeEditor from './components/CodeEditor.vue';

const { t } = useI18n();

const { data } = defineProps<{
  data: any;
}>();

// 试用版追加的动作类型
const actionOptions = [
  { label: '打开链接', value: PenActionType.Link },
  { label: '更改属性', value: PenActionType.SetProps },
  { label: '播放动画', value: PenActionType.StartAnimate },
  { label: '暂停动画', value: PenActionType.PauseAnimate },
  { label: '停止动画', value: PenActionType.StopAnimate },
  { label: '播放视频', value: PenActionType.StartVideo },
  { label: '暂停视频', value: PenActionType.PauseVideo },
  { label: '停止视频', value: PenActionType.StopVideo },
  { label: '自定义函数', value: PenActionType.JS },
  { label: '全局函数', value: PenActionType.GlobalFn },
  { label: '发送消息', value: PenActionType.Emit },
];

// 更改属性时可选的常用属性
const cprops = [
  { value: 'x', label: 'X' },
  { value: 'y', label: 'Y' },
  { value: 'width', label: t('宽') },
  { value: 'height', label: t('高') },
  { value: 'visible', label: t('显示') },
  { value: 'text', label: t('文字') },
  { value: 'color', label: t('颜色') },
  { value: 'background', label: t('背景颜色') },
  { value: 'progress', label: t('进度') },
  { value: 'progressColor', label: t('进度颜色') },
  { value: 'showChild', label: t('状态') },
  { value: 'checked', label: t('选中') },
  { value: 'rotate', label: t('旋转') },
  { value: 'disabled', label: t('禁用') },
  { value: 'animateReverse', label: t('连线动画反向') },
];

const penTree = ref<TreeNode[]>([]);
const groups = ref<{ label: string; value: string }[]>([]);
const animations = ref<string[]>([]);

onBeforeMount(() => {
  if (!data.actions) {
    data.actions = [];
  }
  // 兜底：保证每个动作都有 payload，避免模板访问报错
  data.actions.forEach((action: any) => {
    if (!action.payload) {
      action.payload = {};
    }
  });
  penTree.value = getPenTree();
  groups.value = getGroups();
});

const isAnimateAction = (type?: PenActionType) =>
  type === PenActionType.StartAnimate || type === PenActionType.PauseAnimate || type === PenActionType.StopAnimate;

const isVideoAction = (type?: PenActionType) =>
  type === PenActionType.StartVideo || type === PenActionType.PauseVideo || type === PenActionType.StopVideo;

const getAnimations = (idOrTag?: string) => {
  animations.value = getPenAnimations(idOrTag);
};

// 切换动作类型时重置参数为该类型的默认结构
const onChangeAction = (action: any) => {
  action.payload = {};
  action.target = '';
  delete action.targetType;
  switch (action.type) {
    case PenActionType.Link:
      action.payload.value = '';
      action.payload.params = '_blank';
      break;
    case PenActionType.SetProps:
      action.targetType = TargetType.Pen;
      action.payload.value = {};
      break;
    case PenActionType.StartAnimate:
      getAnimations();
      action.targetType = TargetType.Pen;
      break;
    case PenActionType.PauseAnimate:
    case PenActionType.StopAnimate:
      action.targetType = TargetType.Pen;
      break;
    case PenActionType.StartVideo:
    case PenActionType.PauseVideo:
    case PenActionType.StopVideo:
      action.targetType = TargetType.Pen;
      break;
    case PenActionType.JS:
      action.payload.value = '';
      break;
    case PenActionType.GlobalFn:
      action.payload.value = '';
      action.payload.params = '';
      break;
    case PenActionType.Emit:
      action.payload.value = '';
      action.payload.params = '';
      break;
  }
};

const getPropDesc = (key: string) => cprops.find((elem) => elem.value === key)?.label || key;

const onAddValue = (action: any, e: { value?: string }) => {
  const key = e.value?.trim();
  if (!key || key === 'custom') {
    return;
  }
  if (action.payload.value[key] === undefined) {
    action.payload.value[key] = '';
  }
};

// 输入框得到的是字符串，转换成布尔/数字，否则如 visible: 'false' 会被当成真值
const valueChange = (value: Record<string, any>, key: string) => {
  if (typeof value[key] === 'string') {
    value[key] = changeType(value[key]);
  }
};
</script>
<style lang="postcss" scoped>
.props {
  .prop-grid {
    display: grid;
    grid-template-columns: 50px 110px 16px;
    line-height: 30px;
    gap: 8px;
  }

  .value-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
