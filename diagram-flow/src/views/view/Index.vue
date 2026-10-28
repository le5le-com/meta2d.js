<template>
  <div class="preview">
    <le5le-meta2d></le5le-meta2d>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { createMeta2d, Meta2d, Mode } from '@meta2d/core';
import { getFile } from '../../services/storage';
import { MessagePlugin } from 'tdesign-vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const route = useRoute();

let meta2d: Meta2d;

const npmUrl = (pkg: string): string => {
  // 开发阶段：映射到源码
  if (import.meta.env.DEV) {
    pkg = pkg.replaceAll('@meta2d/', '');
    return `/npm/${pkg}/index.ts`;
  }

  // 生产阶段：单独编译打包到dist/npm目录下
  return `/npm/${'@meta2d/echarts'.replace(/\//g, '_')}.js`;
};

onMounted(async () => {
  createMeta2d();

  meta2d = document.querySelector('le5le-meta2d') as Meta2d;
  meta2d.setMode(Mode.Run); // 预览模式使用运行模式
  meta2d.setOptions({ rule: { enable: false } }); // 预览模式不显示标尺
  meta2d.register(npmUrl('@meta2d/echarts'));

  // 从URL参数获取文件名
  const name = route.query.name as string;
  if (name) {
    try {
      // 获取文件数据
      const fileData = await getFile(decodeURIComponent(name));
      if (fileData) {
        const data = JSON.parse(fileData);

        meta2d.open(data);

        setTimeout(() => {
          meta2d.fitView(true); // 自适应视图，留20px边距
        }, 100);
      } else {
        MessagePlugin.error(t('文件不存在'));
      }
    } catch (error) {
      MessagePlugin.error(t('加载文件失败'));
      return;
    }
  }
});

onBeforeUnmount(() => {});
</script>
<style lang="postcss" scoped>
.preview {
  height: 100vh;
}
</style>
