<template>
  <div class="props">
    <div v-for="(a, index) in data.actions" class="mb-12">
      <div class="flex middle between" style="position: relative">
        <div class="flex middle">{{ $t('动作') }}{{ index + 1 }}</div>
        <close-icon class="hover" @click="data.actions.splice(index, 1)"></close-icon>
      </div>
      <div class="form-item mt-4">
        <label>{{ $t('动作类型') }}</label>
        <t-select v-model="a.action" @change="onChangeAction(a)" :placeholder="$t('请选择')">
          <t-option
            v-for="option in actionOptions"
            :key="option.value"
            :value="option.value"
            :label="$t(option.label)"
          ></t-option>
        </t-select>
      </div>
      <template v-if="a.action == 0">
        <div class="form-item mt-8">
          <label>{{ $t('链接地址') }}</label>
          <t-input v-model="a.value" placeholder="URL"></t-input>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('打开方式') }}</label>
          <t-radio-group v-model="a.params">
            <t-radio value="_blank">{{ $t('新页面') }}</t-radio>
            <t-radio value="_self">{{ $t('当前页面') }}</t-radio>
          </t-radio-group>
        </div>
      </template>
      <template v-else-if="a.action == 13">
        <div class="form-item mt-8">
          <label>{{ $t('视图') }}</label>
          <t-input v-model="a.value" placeholder="ID" />
        </div>
      </template>
      <template v-else-if="a.action == 2 || a.action == 3 || a.action == 4">
        <div class="form-item mt-8">
          <label>{{ $t('对象类型') }}</label>
          <t-radio-group v-model="a.targetType" @change="a.value = ''">
            <t-radio value="id">{{ $t('图元') }}</t-radio>
            <t-radio value="tag">{{ $t('组') }}</t-radio>
          </t-radio-group>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('播放对象') }}</label>
          <t-tree-select
            v-if="a.targetType === 'id'"
            v-model="a.value"
            :data="penTree"
            filterable
            @change="getAnimations(a.value)"
            :placeholder="$t('默认自己')"
          ></t-tree-select>
          <t-select
            v-else
            v-model="a.value"
            :options="groups"
            @change="getAnimations(a.value)"
            :placeholder="$t('组')"
          ></t-select>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('动画名称') }}</label>
          <t-select-input
            v-model:inputValue="a.params"
            :value="a.params"
            v-model:popupVisible="a.popupVisible"
            allow-input
            clearable
            @clear="a.params = undefined"
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
                    a.params = item;
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
      <template v-else-if="a.action == 1">
        <div class="form-item mt-8">
          <label>{{ $t('对象类型') }}</label>
          <t-radio-group v-model="a.targetType" @change="a.params = ''">
            <t-radio value="id">{{ $t('图元') }}</t-radio>
            <t-radio value="tag">{{ $t('组') }}</t-radio>
          </t-radio-group>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('更改对象') }}</label>
          <t-tree-select
            v-if="a.targetType === 'id'"
            v-model="a.params"
            :data="penTree"
            filterable
            placeholder="默认自己"
            @change="getProps(a)"
            clearable
          />
          <t-select v-else v-model="a.params" :options="groups" :placeholder="$t('组')" clearable />
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
                    <t-dropdown-item
                      key="custom"
                      value="custom"
                      disabled="true"
                      divider="true"
                      class="input"
                    >
                      <t-input
                        v-model="a.input"
                        style="pointer-events: auto"
                        :placeholder="$t('自定义')"
                        @enter="
                          onAddValue(a, { key: a.input });
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
            <template v-if="Object.keys(a.value).length" class="center gray mt-8">
              <div class="prop-grid mt-8" v-for="(value, key) in a.value">
                <div class="ml-8 value-label">
                  <t-tooltip :content="key">
                    {{ getPropDesc(a, key) }}
                  </t-tooltip>
                </div>
                <t-input
                  :title="a.value[key]"
                  v-model="a.value[key]"
                  @change="valueChange($event, a.value, key)"
                  :placeholder="$t('值')"
                  :autoWidth="false"
                />
                <delete-icon class="hover" @click="delete a.value[key]" />
              </div>
            </template>
            <div v-else class="center gray mt-8">{{ $t('暂无数据') }}</div>
          </div>
        </div>
      </template>
      <template v-else-if="a.action == 14">
        <div class="form-item mt-8">
          <label>{{ $t('窗口标题') }}</label>
          <t-input v-model="a.value" :placeholder="$t('弹框标题')"></t-input>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('画面') }}URL</label>
          <t-input v-model="a.params" :placeholder="$t('窗口画面URL')"></t-input>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('弹框位置') }}</label>
          <t-input
            label="X"
            placeholder="X"
            v-model.number="a.extend.x"
            style="width: 95px"
            :format="decimalPlaces"
          ></t-input>
          <t-input
            class="ml-4"
            label="Y"
            placeholder="Y"
            v-model.number="a.extend.y"
            style="width: 95px"
            :format="decimalPlaces"
          ></t-input>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('弹框大小') }}</label>
          <t-input
            label="W"
            v-model.number="a.extend.width"
            min="1"
            style="width: 95px"
            :format="decimalPlaces"
            :placeholder="$t('宽')"
          ></t-input>
          <t-input
            class="ml-4"
            label="H"
            v-model.number="a.extend.height"
            min="1"
            style="width: 95px"
            :format="decimalPlaces"
            :placeholder="$t('高')"
          ></t-input>
        </div>
      </template>
      <template v-else-if="a.action == 8 || a.action == 9 || a.action == 10">
        <div class="form-item mt-8">
          <label>{{ $t('对象类型') }}</label>
          <t-radio-group v-model="a.targetType" @change="a.value = ''">
            <t-radio value="id">{{ $t('图元') }}</t-radio>
            <t-radio value="tag">{{ $t('组') }}</t-radio>
          </t-radio-group>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('播放对象') }}</label>
          <t-tree-select
            v-if="a.targetType === 'id'"
            v-model="a.value"
            :data="penTree"
            filterable
            :placeholder="$t('默认自己')"
          ></t-tree-select>
          <t-select v-else v-model="a.value" :options="groups" :placeholder="$t('组')"></t-select>
        </div>
      </template>
      <template v-else-if="a.action == 5">
        <div class="form-item mt-8">
          <div class="w-full">
            <div>function javascriptFn(pen) {</div>
            <CodeEditor
              v-model="a.value"
              class="mt-4"
              @change="codeChange($event, a)"
              style="height: 200px"
            ></CodeEditor>
            <div class="mt-4">}</div>
          </div>
        </div>
      </template>
      <template v-else-if="a.action == 6">
        <div class="form-item mt-8">
          <label>{{ $t('函数名称') }}</label>
          <t-input v-model="a.value" :placeholder="$t('函数名称')"></t-input>
        </div>
        <div class="form-item mt-8">
          <label>{{ $t('函数参数') }}</label>
          <t-input v-model="a.params" :placeholder="$t('函数参数')"></t-input>
        </div>
      </template>
    </div>
    <div class="mt-8">
      <a @click="data.actions.push({})"> + {{ $t('添加动作') }} </a>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeMount, ref, reactive } from 'vue';
import CodeEditor from './components/CodeEditor.vue';
import {
  CloseIcon,
  AddCircleIcon,
  DeleteIcon,
} from 'tdesign-icons-vue-next';
import { useI18n } from 'vue-i18n';
import { Meta2d } from '@meta2d/core';
const { t } = useI18n();
let meta2d: Meta2d;
const { data } = defineProps<{
  data: any;
}>();

const actionOptions = [
  {
    label: t('打开链接'),
    value: 0,
  },
  {
    label: t('打开视图'),
    value: 13,
  },
  {
    label: t('播放动画'),
    value: 2,
  },
  {
    label: t('暂停动画'),
    value: 3,
  },
  {
    label: t('停止动画'),
    value: 4,
  },
  {
    label: t('更改属性'),
    value: 1,
  },
  {
    label: t('打开弹框'),
    value: 14,
  },
  {
    label: t('播放视频'),
    value: 8,
  },
  {
    label: t('暂停视频'),
    value: 9,
  },
  {
    label: t('停止视频'),
    value: 10,
  },
  {
    label: t('自定义函数'),
    value: 5,
  },
  {
    label: t('全局函数'),
    value: 6,
  },
];

const penTree: any = ref([]);
const groups: any = ref([]);
const animations: any = ref([]);

onBeforeMount(() => {
  if (!data.actions) {
    data.actions = [];
  }
  data.actions.forEach((action: any) => {
    if (action.action === 14) {
      if (!action.extend) {
        action.extend = {};
      }
    }
  });
  const timer = setInterval(() => {
    meta2d = document.querySelector('le5le-meta2d') as Meta2d;
    if (meta2d) {
      clearInterval(timer);
    }
  }, 50);

  // penTree.value = getPenTree();
  // propTree.value.unshift({
  //   label: '固定值',
  //   value: '固定值',
  // });
  // const d = meta2d.store.data as any;
  // if (d.groups) {
  //   for (const item of d.groups) {
  //     groups.value.push({ label: item, value: item });
  //   }
  // }

  // animations.value = getPenAnimations();
});

const getAnimations = (idOrTag: string) => {
  // let pens: any[] = meta2d.store.active || [];
  // if (idOrTag) {
  //   pens = meta2d.find(idOrTag) || [];
  // }

  // for (const pen of pens) {
  //   if (pen.animations) {
  //     for (const a of pen.animations) {
  //       animations.push(a.name);
  //     }
  //   }
  // }

  // animations.value = Array.from(new Set(animations));
};

const onChangeAction = (action: any) => {
  switch (action.action) {
    case 0:
      action.value = '';
      action.params = '_blank';
      break;
    case 1:
      action.params = '';
      action.value = {};
      action.targetType = 'id';
      getProps(action);
      break;
    case 2:
    case 3:
    case 4:
    case 8:
    case 9:
    case 10:
      action.value = '';
      action.targetType = 'id';
      break;
    case 14:
      if (!action.extend) {
        action.extend = {};
      }
      break;
    default:
      action.value = '';
      action.params = '';
      break;
  }
};

let cprops = [
  {
    value: 'x',
    label: 'X',
  },
  {
    value: 'y',
    label: 'Y',
  },
  {
    value: 'width',
    label: t('宽'),
  },
  {
    value: 'height',
    label: t('高'),
  },
  {
    value: 'visible',
    label: t('显示'),
  },
  {
    value: 'text',
    label: t('文字'),
  },
  {
    value: 'color',
    label: t('颜色'),
  },
  {
    value: 'background',
    label: t('背景颜色'),
  },
  {
    value: 'progress',
    label: t('进度'),
  },
  {
    value: 'progressColor',
    label: t('进度颜色'),
  },
  {
    value: 'showChild',
    label: t('状态'),
  },
  {
    value: 'checked',
    label: t('选中'),
  },
  {
    value: 'rotate',
    label: t('旋转'),
  },
  {
    value: 'disabled',
    label: t('禁用'),
  },
  {
    value: 'selectedKey',
    label: t('单选选中值'),
  },
  {
    value: 'iframe',
    label: t('网页地址'),
  },
  {
    value: 'animateReverse',
    label: t('连线动画反向'),
  },
];

const getProps = (c: any) => {
  let target: any = [];
  // if (c.params) {
  //   target = meta2d.findOne(c.params);
  // } else if (meta2d.store.active) {
  //   target = meta2d.store.active[0];
  // }
  if (target?.realTimes) {
    for (const item of target.realTimes) {
      const found = cprops.findIndex((elem: any) => elem.value === item.key);
      if (found < 0) {
        cprops.push({
          value: item.key,
          label: item.label,
        });
      }
    }
  }
};

const getPropDesc = (a: any, key: any) => {
  const found = cprops.find((elem: any) => elem.value === key);
  if (found) {
    return found.label;
  }

  return key;
};

const onAddValue = (action: any, data: any) => {
  if (!action.value[data.key]) {
    action.value[data.key] = '';
  }
};

const valueChange = (e, aValue: any, key: any) => {
  // aValue[key] = changeType(e) ?? '';
};

const codeChange = (e: any, a: any) => {
  a.fn = null;
};

const decimalPlaces = (val: number) => {
  if (!val) {
    return undefined;
  }
  return Math.round(+val * 100) / 100;
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
}
</style>
