<template>
  <div class="app-header">
    <a class="logo" href="https://le5le.com" target="_blank">
      <img src="/favicon.ico" />
      <span>乐吾乐</span>
    </a>
    <t-dropdown
      :minColumnWidth="200"
      :maxHeight="560"
      overlayClassName="header-dropdown"
    >
      <a> 文件 </a>
      <t-dropdown-menu>
        <t-dropdown-item @click="newFile">
          <a>新建文件</a>
        </t-dropdown-item>
        <t-dropdown-item @click="openFile" divider="true">
          <a>打开文件</a>
        </t-dropdown-item>

        <t-dropdown-item divider="true">
          <a @click="downloadJson">下载JSON文件</a>
        </t-dropdown-item>

        <t-dropdown-item>
          <a @click="downloadPng">下载为PNG</a>
        </t-dropdown-item>
        <t-dropdown-item>
          <a @click="downloadSvg">下载为SVG</a>
        </t-dropdown-item>
      </t-dropdown-menu>
    </t-dropdown>
    <t-dropdown
      :minColumnWidth="180"
      :maxHeight="500"
      overlayClassName="header-dropdown"
    >
      <a> 编辑 </a>
      <t-dropdown-menu>
        <t-dropdown-item>
          <a @click="onUndo">
            <div class="flex">
              撤销 <span class="flex-grow"></span> Ctrl + Z
            </div>
          </a>
        </t-dropdown-item>
        <t-dropdown-item divider="true">
          <a @click="onRedo">
            <div class="flex">
              恢复 <span class="flex-grow"></span> Ctrl + Y
            </div>
          </a>
        </t-dropdown-item>
        <t-dropdown-item>
          <a @click="onCut">
            <div class="flex">
              剪切 <span class="flex-grow"></span> Ctrl + X
            </div>
          </a>
        </t-dropdown-item>
        <t-dropdown-item>
          <a @click="onCopy">
            <div class="flex">
              复制 <span class="flex-grow"></span> Ctrl + C
            </div>
          </a>
        </t-dropdown-item>
        <t-dropdown-item divider="true">
          <a @click="onPaste">
            <div class="flex">
              粘贴 <span class="flex-grow"></span> Ctrl + V
            </div>
          </a>
        </t-dropdown-item>
        <t-dropdown-item>
          <a @click="onAll">
            <div class="flex">
              全选 <span class="flex-grow"></span> Ctrl + A
            </div>
          </a>
        </t-dropdown-item>
        <t-dropdown-item>
          <a @click="onDelete">
            <div class="flex">删除 <span class="flex-grow"></span> DELETE</div>
          </a>
        </t-dropdown-item>
      </t-dropdown-menu>
    </t-dropdown>
    <t-dropdown
      :minColumnWidth="180"
      :maxHeight="500"
      :delay2="[10, 150]"
      overlayClassName="header-dropdown"
    >
      <a> 帮助 </a>
      <t-dropdown-menu>
        <t-dropdown-item v-for="item in assets.helps" :divider="item.divider">
          <a :href="item.url" target="_blank">{{ item.name }}</a>
        </t-dropdown-item>
      </t-dropdown-menu>
    </t-dropdown>
  </div>
  <div class="app-header">
    <t-tooltip content="撤销">
      <svg class="l-icon" aria-hidden="true" @click="onUndo">
        <use xlink:href="#l-undo"></use>
      </svg>
    </t-tooltip>
    <t-tooltip content="重做">
      <svg class="l-icon" aria-hidden="true" @click="onRedo">
        <use xlink:href="#l-redo"></use>
      </svg>
    </t-tooltip>
    <t-tooltip content="直线">
      <span
        :draggable="true"
        @dragstart="onAddShape($event, 'line')"
        @click="onAddShape($event, 'line')"
      >
        <t-icon name="slash" />
      </span>
    </t-tooltip>
    <t-tooltip content="文字">
      <span
        :draggable="true"
        @dragstart="onAddShape($event, 'text')"
        @click="onAddShape($event, 'text')"
      >
        <svg class="l-icon" aria-hidden="true">
          <use xlink:href="#l-text"></use>
        </svg>
      </span>
    </t-tooltip>
    <t-tooltip content="连线">
      <svg
        width="1em"
        height="1em"
        viewBox="0 0 1024 1024"
        xmlns="http://www.w3.org/2000/svg"
        @click="drawLine"
        :style="{
          color: isDrawLine ? ' #1677ff' : '',
        }"
      >
        <path
          d="M192 64a128 128 0 0 1 123.968 96H384a160 160 0 0 1 159.68 149.504L544 320v384a96 96 0 0 0 86.784 95.552L640 800h68.032a128 128 0 1 1 0 64.064L640 864a160 160 0 0 1-159.68-149.504L480 704V320a96 96 0 0 0-86.784-95.552L384 224l-68.032 0.064A128 128 0 1 1 192 64z m640 704a64 64 0 1 0 0 128 64 64 0 0 0 0-128zM192 128a64 64 0 1 0 0 128 64 64 0 0 0 0-128z"
          fill="currentColor"
        ></path>
      </svg>
    </t-tooltip>
    <t-dropdown
      :minColumnWidth="160"
      :maxHeight="560"
      overlayClassName="header-dropdown"
    >
      <a>
        <svg class="l-icon" aria-hidden="true">
          <use
            :xlink:href="
              lineTypes.find((item) => item.value === currentLineType)?.icon
            "
          ></use>
        </svg>
      </a>
      <t-dropdown-menu>
        <t-dropdown-item v-for="item in lineTypes">
          <div class="flex middle" @click="changeLineType(item.value)">
            {{ item.name }} <span class="flex-grow"></span>
            <svg class="l-icon" aria-hidden="true">
              <use :xlink:href="item.icon"></use>
            </svg>
          </div>
        </t-dropdown-item>
      </t-dropdown-menu>
    </t-dropdown>
    <t-dropdown
      :minColumnWidth="160"
      :maxHeight="560"
      :delay2="[10, 150]"
      overlayClassName="header-dropdown"
    >
      <a>
        <svg class="l-icon" aria-hidden="true">
          <use
            :xlink:href="
              fromArrows.find((item) => item.value === fromArrow)?.icon
            "
          ></use>
        </svg>
      </a>
      <t-dropdown-menu>
        <t-dropdown-item v-for="item in fromArrows">
          <div
            class="flex middle"
            style="height: 30px"
            @click="changeFromArrow(item.value)"
          >
            <svg class="l-icon" aria-hidden="true">
              <use :xlink:href="item.icon"></use>
            </svg>
          </div>
        </t-dropdown-item>
      </t-dropdown-menu>
    </t-dropdown>
    <t-dropdown
      :minColumnWidth="160"
      :maxHeight="560"
      :delay2="[10, 150]"
      overlayClassName="header-dropdown"
    >
      <a>
        <svg class="l-icon" aria-hidden="true">
          <use
            :xlink:href="toArrows.find((item) => item.value === toArrow)?.icon"
          ></use>
        </svg>
      </a>
      <t-dropdown-menu>
        <t-dropdown-item v-for="item in toArrows">
          <div
            class="flex middle"
            style="height: 30px"
            @click="changeToArrow(item.value)"
          >
            <svg class="l-icon" aria-hidden="true">
              <use :xlink:href="item.icon"></use>
            </svg>
          </div>
        </t-dropdown-item>
      </t-dropdown-menu>
    </t-dropdown>
    <div style="width: 64px"></div>
    <div v-show="scale > 0" style="line-height: 40px">{{ scale }}%</div>
    <t-tooltip content="100%视图" placement="bottom">
      <a @click="onScaleDefault"><t-icon name="refresh" /></a>
    </t-tooltip>
    <t-tooltip content="窗口大小" placement="bottom">
      <a @click="onScaleWindow" style="margin-left: -16px"
        ><t-icon name="fullscreen-exit"
      /></a>
    </t-tooltip>
    <div style="width: 36px"></div>
    <t-tooltip content="运行查看">
      <t-icon name="play-circle-stroke" @click="onView" />
    </t-tooltip>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Pen, PenType, deepClone } from '@meta2d/core';
// @ts-ignore
import FileSaver from 'file-saver';
import { MessagePlugin } from 'tdesign-vue-next';

const router = useRouter();

const assets = reactive({
  home: 'https://le5le.com',
  helps: [
    {
      name: '产品介绍',
      url: 'https://doc.le5le.com/document/118756411',
    },
    {
      name: '快速上手',
      url: 'https://doc.le5le.com/document/119363000',
    },
    {
      name: '使用手册',
      url: 'https://doc.le5le.com/document/118764244',
    },
    {
      name: '快捷键',
      url: 'https://doc.le5le.com/document/119620214',
      divider: true,
    },
    {
      name: '企业服务与支持',
      url: 'https://doc.le5le.com/document/119296274',
      divider: true,
    },
    {
      name: '关于我们',
      url: 'https://le5le.com/about.html',
    },
  ],
});

const isDrawLine = ref<boolean>(false);

const scale = ref(0);

onMounted(() => {
  const timer = setInterval(() => {
    if (meta2d) {
      clearInterval(timer);
      // 获取初始缩放比例
      scaleSubscriber(meta2d.store.data.scale);

      // 监听缩放
      // @ts-ignore
      meta2d.on('scale', scaleSubscriber);
    }
  }, 200);
});

const scaleSubscriber = (val: number) => {
  scale.value = Math.round(val * 100);
};

const drawLine = () => {
  if (isDrawLine.value) {
    isDrawLine.value = false;
    meta2d.finishDrawLine();
    meta2d.drawLine();
    meta2d.store.options.disableAnchor = true;
  } else {
    isDrawLine.value = true;
    meta2d.drawLine(meta2d.store.options.drawingLineName);
    meta2d.store.options.disableAnchor = false;
  }
};

const lineTypes = reactive([
  { name: '曲线', icon: '#l-curve2', value: 'curve' },
  { name: '线段', icon: '#l-polyline', value: 'polyline' },
  { name: '直线', icon: '#l-line', value: 'line' },
  { name: '脑图曲线', icon: '#l-mind', value: 'mind' },
]);
const currentLineType = ref('curve');

const changeLineType = (value: string) => {
  currentLineType.value = value;
  if (meta2d) {
    meta2d.store.options.drawingLineName = value;
    meta2d.canvas.drawingLineName && (meta2d.canvas.drawingLineName = value);
    meta2d.store.active?.forEach((pen) => {
      meta2d.updateLineType(pen, value);
    });
  }
};

const fromArrow = ref('');
const fromArrows = [
  { icon: '#l-line', value: '' },
  { icon: '#l-from-triangle', value: 'triangle' },
  { icon: '#l-from-diamond', value: 'diamond' },
  { icon: '#l-from-circle', value: 'circle' },
  { icon: '#l-from-lineDown', value: 'lineDown' },
  { icon: '#l-from-lineUp', value: 'lineUp' },
  { icon: '#l-from-triangleSolid', value: 'triangleSolid' },
  { icon: '#l-from-diamondSolid', value: 'diamondSolid' },
  { icon: '#l-from-circleSolid', value: 'circleSolid' },
  { icon: '#l-from-line', value: 'line' },
];
const toArrow = ref('');
const toArrows = [
  { icon: '#l-line', value: '' },
  { icon: '#l-to-triangle', value: 'triangle' },
  { icon: '#l-to-diamond', value: 'diamond' },
  { icon: '#l-to-circle', value: 'circle' },
  { icon: '#l-to-lineDown', value: 'lineDown' },
  { icon: '#l-to-lineUp', value: 'lineUp' },
  { icon: '#l-to-triangleSolid', value: 'triangleSolid' },
  { icon: '#l-to-diamondSolid', value: 'diamondSolid' },
  { icon: '#l-to-circleSolid', value: 'circleSolid' },
  { icon: '#l-to-line', value: 'line' },
];

const changeFromArrow = (value: string) => {
  fromArrow.value = value;
  // 画布默认值
  meta2d.store.data.fromArrow = value;
  // 活动层的箭头都变化
  if (meta2d.store.active) {
    meta2d.store.active.forEach((pen: Pen) => {
      if (pen.type === PenType.Line) {
        pen.fromArrow = value;
        meta2d.setValue(
          {
            id: pen.id,
            fromArrow: pen.fromArrow,
          },
          {
            render: false,
          }
        );
      }
    });
    meta2d.render();
  }
};

const changeToArrow = (value: string) => {
  toArrow.value = value;
  // 画布默认值
  meta2d.store.data.toArrow = value;
  // 活动层的箭头都变化
  if (meta2d.store.active) {
    meta2d.store.active.forEach((pen: Pen) => {
      if (pen.type === PenType.Line) {
        pen.toArrow = value;
        meta2d.setValue(
          {
            id: pen.id,
            toArrow: pen.toArrow,
          },
          {
            render: false,
          }
        );
      }
    });
    meta2d.render();
  }
};

const newFile = () => {
  meta2d.open({ name: '新建项目', pens: [] } as any);
};

function readFile(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

const openFile = () => {
  // 1. 显示选择文件对话框
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async (event) => {
    const elem = event.target as HTMLInputElement;
    if (elem.files && elem.files[0]) {
      // 2. 读取文件字符串内容
      const text = await readFile(elem.files[0]);
      try {
        // 3. 打开文件内容
        meta2d.open(JSON.parse(text));

        // 可选：缩放到窗口大小展示
        meta2d.fitView();
      } catch (e) {
        console.log(e);
      }
    }
  };
  input.click();
};

const downloadJson = () => {
  const data: any = meta2d.data();
  FileSaver.saveAs(
    new Blob([JSON.stringify(data)], {
      type: 'text/plain;charset=utf-8',
    }),
    `${data.name || 'le5le.meta2d'}.json`
  );
};

const downloadPng = () => {
  let name = (meta2d.store.data as any).name;
  if (name) {
    name += '.png';
  }
  meta2d.downloadPng(name);
};

// 判断该画笔 是否是组合为状态中 展示的画笔
function isShowChild(pen: any, store: any) {
  let selfPen = pen;
  while (selfPen && selfPen.parentId) {
    const oldPen = selfPen;
    selfPen = store.pens[selfPen.parentId];
    const showChildIndex = selfPen?.calculative?.showChild;
    if (showChildIndex != undefined) {
      const showChildId = selfPen.children[showChildIndex];
      if (showChildId !== oldPen.id) {
        return false;
      }
    }
  }
  return true;
}

const downloadSvg = () => {
  if (!C2S) {
    MessagePlugin.error('请先加载乐吾乐官网下的canvas2svg.js');
    return;
  }

  const rect: any = meta2d.getRect();
  rect.x -= 10;
  rect.y -= 10;
  const ctx = new C2S(rect.width + 20, rect.height + 20);
  ctx.textBaseline = 'middle';
  for (const pen of meta2d.store.data.pens) {
    if (pen.visible == false || !isShowChild(pen, meta2d.store)) {
      continue;
    }
    meta2d.renderPenRaw(ctx, pen, rect);
  }

  let mySerializedSVG = ctx.getSerializedSvg();
  if (meta2d.store.data.background) {
    mySerializedSVG = mySerializedSVG.replace('{{bk}}', '');
    mySerializedSVG = mySerializedSVG.replace(
      '{{bkRect}}',
      `<rect x="0" y="0" width="100%" height="100%" fill="${meta2d.store.data.background}"></rect>`
    );
  } else {
    mySerializedSVG = mySerializedSVG.replace('{{bk}}', '');
    mySerializedSVG = mySerializedSVG.replace('{{bkRect}}', '');
  }

  mySerializedSVG = mySerializedSVG.replace(/--le5le--/g, '&#x');

  const urlObject: any = (window as any).URL || window;
  const export_blob = new Blob([mySerializedSVG]);
  const url = urlObject.createObjectURL(export_blob);

  const a = document.createElement('a');
  a.setAttribute(
    'download',
    `${(meta2d.store.data as any).name || 'le5le.meta2d'}.svg`
  );
  a.setAttribute('href', url);
  const evt = document.createEvent('MouseEvents');
  evt.initEvent('click', true, true);
  a.dispatchEvent(evt);
};

const onUndo = () => {
  meta2d.undo();
};

const onRedo = () => {
  meta2d.redo();
};

const onCut = () => {
  meta2d.cut();
};

const onCopy = () => {
  meta2d.copy();
};

const onPaste = () => {
  meta2d.paste();
};

const onAll = () => {
  meta2d.activeAll();
};

const onDelete = () => {
  meta2d.delete();
};

const onAddShape = (event: DragEvent | MouseEvent, name: string) => {
  event.stopPropagation();
  let data: any;
  if (name === 'text') {
    // 构建一个文本图元
    data = {
      text: 'text',
      width: 100,
      height: 20,
      name: 'text',
    };
  } else if (name === 'line') {
    // 构建一个直线图元
    data = {
      anchors: [
        { id: '0', x: 1, y: 0 },
        { id: '1', x: 0, y: 1 },
      ],
      width: 100,
      height: 100,
      name: 'line',
      lineName: 'line',
      type: 1,
    };
  }
  if (!(event as DragEvent).dataTransfer) {
    // 支持点击画布添加
    meta2d.canvas.addCaches = deepClone([data]);
  } else {
    // 支持拖拽添加
    (event as DragEvent).dataTransfer?.setData('Meta2d', JSON.stringify(data));
  }
};

const onScaleDefault = () => {
  meta2d.scale(1);
  meta2d.centerView();
};

const onScaleWindow = () => {
  meta2d.fitView();
};

const onView = () => {
  // 先停止动画，避免数据波动
  meta2d.stopAnimate();
  // 本地存储
  const data: any = meta2d.data();
  localStorage.setItem('meta2d', JSON.stringify(data));
  // 跳转到预览页面
  router.push({
    path: '/preview',
    query: {
      r: Date.now() + '',
      id: data._id,
    },
  });
};
</script>
<style lang="postcss" scoped>
.app-header {
  display: flex;
  height: 40px;
  padding: 0 12px;
  position: relative;
  border-bottom: 1px solid var(--color-border);
  z-index: 2;

  .logo {
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 500;
    padding-left: 0;

    img {
      height: 20px;
      margin-right: 6px;
    }
  }

  a {
    display: flex;
    padding: 0 8px;
    margin: 0 8px;
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
      background-color: var(--color-primary-hover);
      color: #ffffff;
    }
  }

  svg {
    height: 40px;
    margin: 0 8px;
    &:hover {
      color: var(--color-primary);
      cursor: pointer;
    }
  }
}
</style>

<style>
.t-dropdown__item-text {
  a {
    color: var(--color);
    text-decoration: none;
    white-space: nowrap;

    &:hover {
      color: var(--color-primary);
    }
  }
}
</style>
