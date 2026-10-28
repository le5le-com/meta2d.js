<template>
  <div class="app-header">
    <div class="flex middle">
      <a class="logo" href="https://le5le.com" target="_blank">
        <img src="/favicon.ico" />
        <span> {{ $t('乐吾乐') }}</span>
      </a>
      <t-dropdown :minColumnWidth="200" :maxHeight="560">
        <a> {{ $t('文件') }} </a>
        <t-dropdown-menu>
          <t-dropdown-item @click="newFile">
            <a>{{ $t('新建文件') }}</a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="showFileListDialog">{{ $t('打开文件') }}</a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a>{{ $t('打开最近文件') }}</a>
            <t-dropdown-menu>
              <t-dropdown-item v-for="(item, i) in recentMetadatas" :key="i" :value="i" @click="openFile(item.name)">
                {{ item.name }}
              </t-dropdown-item>
              <t-dropdown-item v-if="recentMetadatas.length > 0" :value="-1" @click="showFileListDialog">
                {{ $t('更多...') }}
              </t-dropdown-item>
              <t-dropdown-item v-else :value="-1" :disabled="true">
                {{ $t('暂无文件') }}
              </t-dropdown-item>
            </t-dropdown-menu>
          </t-dropdown-item>
          <t-dropdown-item divider="true">
            <a @click="openLocalFile">{{ $t('打开本地文件') }}</a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="save">{{ $t('保存') }}</a>
          </t-dropdown-item>
          <t-dropdown-item divider="true">
            <a @click="saveas">{{ $t('另存为...') }}</a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="download">{{ $t('下载文件') }}</a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="downloadPng">{{ $t('导出为PNG') }}</a>
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
      <t-dropdown :minColumnWidth="180" :maxHeight="500">
        <a> {{ $t('编辑') }} </a>
        <t-dropdown-menu>
          <t-dropdown-item>
            <a @click="undo">
              <div class="flex">{{ $t('撤销') }} <span class="flex-grow"></span> Ctrl + Z</div>
            </a>
          </t-dropdown-item>
          <t-dropdown-item divider="true">
            <a @click="redo">
              <div class="flex">{{ $t('重做') }} <span class="flex-grow"></span> Ctrl + Y</div>
            </a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="cut">
              <div class="flex">{{ $t('剪切') }} <span class="flex-grow"></span> Ctrl + X</div>
            </a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="copy">
              <div class="flex">{{ $t('复制') }} <span class="flex-grow"></span> Ctrl + C</div>
            </a>
          </t-dropdown-item>
          <t-dropdown-item divider="true">
            <a @click="paste">
              <div class="flex">{{ $t('粘贴') }} <span class="flex-grow"></span> Ctrl + V</div>
            </a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="selectAll">
              <div class="flex">{{ $t('全选') }} <span class="flex-grow"></span> Ctrl + A</div>
            </a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="del">
              <div class="flex">{{ $t('删除') }} <span class="flex-grow"></span> DELETE</div>
            </a>
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
      <t-dropdown :minColumnWidth="180" :maxHeight="500">
        <a> {{ $t('工具') }} </a>
        <t-dropdown-menu>
          <t-dropdown-item>
            <a @click="fitWindowSize">{{ $t('窗口大小') }}</a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="scaleUp">{{ $t('放大') }}</a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="scaleDown">{{ $t('缩小') }}</a>
          </t-dropdown-item>
          <t-dropdown-item divider="true">
            <a @click="resetView">100%{{ $t('视图') }}</a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="toggleMiniMap">
              <div class="flex middle">
                {{ $t('小地图') }} <span class="flex-grow"></span>
                <check-icon v-show="minimap" />
              </div>
            </a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a @click="toggleAutoAnchor">
              <div class="flex middle">
                {{ $t('鼠标移入显示锚点') }} <span class="flex-grow"></span>
                <check-icon v-show="autoAnchor" />
              </div>
            </a>
          </t-dropdown-item>

          <t-dropdown-item>
            <a @click="toggleEditAnchor">
              <div class="flex middle">
                {{ $t('编辑锚点') }} <span class="flex-grow"></span>
                <check-icon v-show="editAnchor" />
              </div>
            </a>
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
      <t-dropdown :minColumnWidth="180" :maxHeight="500">
        <a> {{ $t('帮助') }} </a>
        <t-dropdown-menu>
          <t-dropdown-item>
            <a>{{ $t('快捷键') }}</a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a href="https://doc.le5le.com" target="_blank">{{ $t('Meta2d.js教程') }}</a>
          </t-dropdown-item>

          <t-dropdown-item divider="true">
            <a href="https://github.com/le5le-com/meta2d.js">Github</a>
          </t-dropdown-item>
          <t-dropdown-item>
            <a>{{ $t('关于') }}</a>
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
    </div>

    <input v-model="filename" @change="onInputFilename($event)" />

    <div class="flex middle" style="justify-content: end">
      <t-dropdown :minColumnWidth="180" :maxHeight="500">
        <a style="margin-right: 0"> <Translate1Icon size="18" /></a>
        <t-dropdown-menu>
          <t-dropdown-item v-for="item in languages">
            <div @click="changeLanguage(item.value)">{{ item.name }}</div>
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
      <a href="https://le5le.com/enterprise/solution" target="_blank" class="app mr-12">
        <app-icon />
        {{ $t('应用广场') }}
      </a>
    </div>
  </div>
  <t-dialog v-model:visible="fileListDialogVisible" :title="$t('打开文件')" :footer="false" width="600px">
    <div class="file-list">
      <div v-for="(item, i) in currentPageMetadata" :key="i" class="file-item" @click="open(currentPageFiles[i]?.data)">
        <img :src="thumbnailUrls.get(item.name) || '/logo.png'" alt="file" class="file-thumbnail" />
        <div class="file-item-info">
          <span>{{ item.name }}</span>
          <span class="file-item-time">
            {{ new Date(item.updateTime).toLocaleDateString() }}<br />{{
              new Date(item.updateTime).toLocaleTimeString()
            }}
          </span>
        </div>
        <t-button theme="danger" size="small" variant="text" class="delete-button" @click.stop="delFile(item.name)">
          <DeleteIcon slot="icon" />
        </t-button>
      </div>
    </div>
    <div v-if="currentPageFiles.length === 0" class="empty-tip">
      {{ $t('暂无文件') }}
    </div>
    <t-pagination
      v-model="pageConfig.current"
      :total="fileMetadatas.length"
      :page-size="pageConfig.pageSize"
      :show-jumper="false"
      :show-sizer="true"
      :page-size-options="[12, 24, 48, 96]"
      @page-size-change="pageConfig.pageSize = $event"
      style="margin-top: 16px; justify-content: center"
    />
  </t-dialog>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount, ref, computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { AppIcon, CheckIcon, Translate1Icon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { Meta2d, FitViewOrigin, AnchorMode, RuleStyle } from '@meta2d/core';
import { dataUpgrade } from '@meta2d/data-upgrade';
import saveAs from 'file-saver';
import { DeleteIcon } from 'tdesign-icons-vue-next';
import { addFile, existFile, getFile, listFile, updateFile, deleteFile, getMetadata } from '../../services/storage';
import { readFile } from '../../services/file';
import { useSelection, SelectionMode } from './services/selections';
import { emitter } from './services/emitter';
const { selections } = useSelection();

const router = useRouter();
const route = useRoute();

const { locale, t } = useI18n();
const languages = [
  {
    name: '简体中文',
    value: 'zh',
  },
  {
    name: '繁体中文',
    value: 'zh_CHT',
  },
  {
    name: 'English',
    value: 'en',
  },
];

const autoAnchor = ref(false);
const editAnchor = ref(false);
const minimap = ref(false);

let meta2d: Meta2d;

onMounted(async () => {
  fileMetadatas.value = await getMetadata();
  const timer = setInterval(() => {
    meta2d = document.querySelector('le5le-meta2d') as Meta2d;
    if (meta2d) {
      clearInterval(timer);

      if (route.query.name) {
        openFile(route.query.name as string);
      }
    }
  }, 50);

  emitter.on('new', newFile);
  emitter.on('save', save);
  emitter.on('undo', undo);
  emitter.on('redo', redo);
  emitter.on('resetView', resetView);
  emitter.on('openFile', showFileListDialog);
  emitter.on('downloadJson', download);
  emitter.on('saveas', saveas);
});

onBeforeUnmount(() => {
  thumbnailUrls.value.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  thumbnailUrls.value.clear();
});

const open = (text: string, local = false) => {
  if (!text) {
    MessagePlugin.error(t('文件内容为空'));
    return;
  }
  let data: any;
  try {
    data = JSON.parse(text);
    if (!data) {
      return;
    }
    filename.value = data.name || '未命名文件';
    if (data.version < '2.0.0') {
      dataUpgrade(data);
    }
  } catch (err) {
    MessagePlugin.error(t('打开文件错误：') + err.toString());
    return;
  }

  if (!meta2d) {
    MessagePlugin.error(t('编辑器还未加载'));
    return;
  }

  meta2d.open(data);
  selections.mode = SelectionMode.File;
  emitter.emit('open', data);

  router.replace({
    path: route.path,
    query: {
      name: local ? undefined : encodeURIComponent(filename.value),
    },
  });
};

const fileMetadatas = ref<any>([]); // 所有文件元数据 文件名和更新时间
const recentMetadatas = computed(() => {
  return fileMetadatas.value.slice(0, 10);
});
const currentPageMetadata = computed(() => {
  return fileMetadatas.value.slice(
    (pageConfig.current - 1) * pageConfig.pageSize,
    pageConfig.current * pageConfig.pageSize
  );
});
const currentPageFiles = ref<any[]>([]);
const fileListDialogVisible = ref(false); // 文件列表对话框是否显示
const pageConfig = reactive({
  current: 1,
  pageSize: 12,
});

const filename = ref('未命名文件');
const thumbnailUrls = ref<Map<string, string>>(new Map()); // 缓存缩略图的 Object URL

const showFileListDialog = () => {
  fileListDialogVisible.value = true;
};

const newFile = () => {
  router.replace({ path: route.path, query: {} });
  filename.value = '未命名文件';
  const meta2d = document.querySelector('le5le-meta2d') as Meta2d;
  if (!meta2d) {
    MessagePlugin.error(t('编辑器还未加载'));
    return;
  }

  meta2d.open({ name: filename.value, rule: { enable: true, style: RuleStyle.Simple } });
  selections.mode = SelectionMode.File;

  router.replace({
    path: route.path,
    query: {},
  });
};

const openFile = async (name: string) => {
  const text = await getFile(decodeURIComponent(name));
  open(text);
};

const openLocalFile = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async (event) => {
    const elem = event.target as HTMLInputElement;
    if (elem.files && elem.files[0]) {
      const text = await readFile(elem.files[0]);
      open(text, true);
    }
  };
  input.click();
};

const delFile = async (name: string) => {
  deletaThumbnailUrl(name);
  await deleteFile(name);
  fileMetadatas.value = await getMetadata();
};

const save = async () => {
  const data = meta2d.getData() as any;
  data.name = filename.value;
  const thumbnail = await generateThumbnail();

  let err: string | void;
  if (route.query.name) {
    const oldName = decodeURIComponent(route.query.name as string);
    deletaThumbnailUrl(oldName);
    err = await updateFile(filename.value, JSON.stringify(data), oldName, thumbnail);
  } else {
    err = await addFile(filename.value, JSON.stringify(data), false, thumbnail);
  }

  if (err) {
    MessagePlugin.error(err);
    return;
  }

  router.replace({
    path: route.path,
    query: {
      name: encodeURIComponent(filename.value),
    },
  });

  fileMetadatas.value = await getMetadata();

  MessagePlugin.success(t('保存成功'));
};

const saveas = async () => {
  let name = filename.value;
  if (await existFile(name)) {
    name = filename.value + '（副本）';
    if (await existFile(name)) {
      MessagePlugin.error('存在同名文件：' + name);
      return;
    }
  }
  const data = meta2d.getData();
  data.name = name;

  const thumbnail = await generateThumbnail();
  const err = await addFile(name, JSON.stringify(data), false, thumbnail);
  if (err) {
    MessagePlugin.error(err);
    return;
  }

  filename.value = name;
  router.replace({
    path: route.path,
    query: {
      name: encodeURIComponent(filename.value),
    },
  });

  fileMetadatas.value = await getMetadata();

  MessagePlugin.success(t('保存成功'));
};

watch(currentPageMetadata, async () => {
  currentPageFiles.value = await listFile(currentPageMetadata.value);
  getThumbnailUrl();
});

const deletaThumbnailUrl = (name: string) => {
  const url = thumbnailUrls.value.get(name);
  if (url) {
    URL.revokeObjectURL(url);
    thumbnailUrls.value.delete(name);
  }
};

const getThumbnailUrl = () => {
  currentPageFiles.value.forEach((item: any, index: number) => {
    if (!item || !item.thumbnail) {
      return '/logo.png';
    }
    const name = currentPageMetadata.value[index].name;
    if (thumbnailUrls.value.has(name)) {
      return thumbnailUrls.value.get(name)!;
    }
    const url = URL.createObjectURL(item.thumbnail);
    thumbnailUrls.value.set(name, url);
  });
};

const generateThumbnail = (): Promise<Blob | null> => {
  return new Promise((resolve) => {
    if (!meta2d) {
      resolve(null);
      return;
    }

    meta2d.toPng(
      {
        maxWidth: 200,
        padding: 2,
      },
      (buffer: ArrayBuffer) => {
        if (buffer) {
          const blob = new Blob([buffer], { type: 'image/png' });
          resolve(blob);
        } else {
          resolve(null);
        }
      }
    );
  });
};

const download = () => {
  const data = meta2d.getData();

  saveAs(
    new Blob([JSON.stringify(data)], {
      type: 'text/plain;charset=utf-8',
    }),
    `${filename.value || data.name || 'meta2d'}.json`
  );
};

const downloadPng = () => {
  meta2d.toPng();
};

const undo = () => {
  meta2d.undo();
};

const redo = () => {
  meta2d.redo();
};

const cut = async () => {
  if (!meta2d.activePens || !meta2d.activePens.length) {
    MessagePlugin.warning(t('请先选择要剪切的图元'));
    return;
  }
  meta2d.onCut();
};

const copy = async () => {
  if (!meta2d.activePens || !meta2d.activePens.length) {
    MessagePlugin.warning(t('请先选择要复制的图元'));
    return;
  }
  meta2d.onCopy();
};

const paste = async () => {
  meta2d.onPaste();
};

const selectAll = () => {
  meta2d.topElement.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'a',
    code: 'A',
    ctrlKey: true,
  }));
};

const del = async () => {
  if (!meta2d.activePens || !meta2d.activePens.length) {
    MessagePlugin.warning(t('请先选择要删除的对象'));
    return;
  }
  await meta2d.deletePens(meta2d.activePens);
};

const fitWindowSize = () => {
  meta2d.fitView(true, 10);
};

const scaleUp = () => {
  meta2d.scale(meta2d.data.scale + 0.1);
};

const scaleDown = () => {
  meta2d.scale(meta2d.data.scale - 0.1);
};

const resetView = () => {
  meta2d.fitView(1, 10, FitViewOrigin.Left);
};

const toggleMiniMap = () => {
  minimap.value = !minimap.value;
};

const toggleAutoAnchor = () => {
  autoAnchor.value = !autoAnchor.value;
  meta2d.setOptions({ anchorMode: autoAnchor.value ? AnchorMode.Hover : AnchorMode.Hidden });
};

const toggleEditAnchor = () => {
  editAnchor.value = !editAnchor.value;
};

const onInputFilename = (event: Event) => {
  const target = event.target as HTMLInputElement;
  filename.value = target.value;
};

function changeLanguage(v) {
  locale.value = v;
  localStorage.setItem('i18n', v);
}
</script>
<style lang="postcss" scoped>
.app-header {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  height: 40px;
  border-bottom: 1px solid var(--color-border);
  position: relative;
  z-index: 2;

  .logo {
    display: flex;
    padding: 0 16px;
    align-items: center;
    font-size: 15px;
    font-weight: 500;
    margin-top: -2px;
    img {
      height: 22px;
      margin-right: 6px;
    }
  }

  a {
    display: flex;
    height: 40px;
    padding: 0 10px;
    align-items: center;
    color: var(--color);
    text-decoration: none;
    white-space: nowrap;

    &:hover {
      color: var(--color-primary);
    }

    svg {
      font-size: 15px;
      margin: 2px 4px 0 0;
    }

    &.active {
      background-color: var(--color-primary);
      color: #ffffff;
    }
  }

  input {
    font-size: 14px;
    flex: 1 1 0;
    min-width: 100px;
    background: none;
    outline: none;
    border: none;
    text-align: center;
    color: var(--color-title);
  }

  .app {
    background-color: var(--color-primary);
    color: #ffffff !important;
    height: 30px;
    border-radius: 5px;
    &:hover {
      background-color: var(--color-primary-hover);
    }
  }
}
.file-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: min-content;
  gap: 10px;
  height: 50vh;
  overflow: auto;
  .file-item {
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    cursor: pointer;
    position: relative;
    .file-thumbnail {
      width: 100%;
      height: 150px;
      object-fit: contain;
      margin-bottom: 8px;
      border-radius: 5px;
    }
    &-info {
      display: flex;
      justify-content: space-between;
      gap: 5px;
      font-size: 12px;
      span:first-child {
        width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .file-item-time {
        text-align: center;
      }
    }
  }
  .delete-button {
    position: absolute;
    right: 10px;
    top: 10px;
  }
}
.empty-tip {
  height: 20vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gray);
}
</style>
