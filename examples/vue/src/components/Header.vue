<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
const isPenActive = ref(false);
const isPencilActive = ref(false);
const isMagnifierActive = ref(false);
const isMinimapActive = ref(false);

const onCreate = () => {
  window.meta2d.open();
};
const onOpen = (e) => {
  const file = e.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const json = JSON.parse(event.target.result);
      window.meta2d.open(json);
    } catch(e) {
      console.log("读取文件失败，请检查数据格式");
    }
  };
  reader.readAsText(file);
};
const onSave = () => {
  const filename = "测试数据.json";
  const data = window.meta2d.data();
  const json = JSON.stringify(data, undefined, 4);
  const blob = new Blob([json], { type: "text/json" });
  const a = document.createElement("a");
  a.download = filename;
  a.href = window.URL.createObjectURL(blob);
  a.dataset.downloadurl = ["text/json", a.download, a.href].join(":");
  a.click();
};
const onTogglePen = () => {
  isPencilActive.value = false;
  window.meta2d.finishPencil();
  isPenActive.value = true;
  window.meta2d.drawLine("curve");
};
const onTogglePencil = () => {
  if (isPenActive.value === true) {
    return;
  }
  if (isPencilActive.value === true) {
    isPencilActive.value = false;
    window.meta2d.stopPencil();
  } else {
    isPencilActive.value = true;
    window.meta2d.drawingPencil();
  }
};
const onToggleMagnifier = () => {
  if (isMagnifierActive.value === true) {
    isMagnifierActive.value = false;
    window.meta2d.hideMagnifier();
  } else {
    isMagnifierActive.value = true;
    window.meta2d.showMagnifier();
  }
};
const onToggleMinimap = () => {
  if (isMinimapActive.value === true) {
    isMinimapActive.value = false;
    window.meta2d.hideMap();
  } else {
    isMinimapActive.value = true;
    window.meta2d.showMap();
  }
};
const onHelp = () => {
  window.open("https://www.yuque.com/alsmile/topology/cucep0");
};

const onKeyDown = (e) => {
  switch (e.key) {
    case "b":
    case "B":
      if (window.meta2d.canvas.pencil) {
        isPencilActive.value = true;
      } else {
        isPencilActive.value = false;
      }
      break;
    case "v":
    case "V":
      if (e.ctrlKey || e.metaKey) {
        return;
      } else {
        if (window.meta2d.canvas.drawingLineName) {
          isPenActive.value = true;
        } else {
          isPenActive.value = false;
        }
      }
      break;
    case "m":
    case "M":
      if (window.meta2d.canvas.magnifier) {
        isMinimapActive.value = true;
      } else {
        isMinimapActive.value = false;
      }
      break;
    case "Escape":
      isPenActive.value = false;
      isPencilActive.value = false;
      isMagnifierActive.value = false;
      break;
    default:
      break;
  }
};

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div class="header">
    <div class="logo">
      <img src="../assets/images/favicon.ico" alt="乐吾乐" />
    </div>
    <div class="button-group">
      <button id="create" @click="onCreate">新建文件</button>
      <button id="open">
        打开文件
        <input id="open-input" type="file" @change="onOpen" />
      </button>
      <button id="save" @click="onSave">保存</button>
      <button id="pen" :class="{ active: isPenActive }" @click="onTogglePen">钢笔</button>
      <button id="pencil" :class="{ active: isPencilActive }" @click="onTogglePencil">铅笔</button>
      <button id="magnifier" :class="{ active: isMagnifierActive }" @click="onToggleMagnifier">放大镜</button>
      <button id="minimap" :class="{ active: isMinimapActive }" @click="onToggleMinimap">缩略图</button>
      <button id="help" @click="onHelp">帮助</button>
    </div>
  </div>
</template>

<style scoped>
</style>
