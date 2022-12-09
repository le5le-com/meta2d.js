<!--
 * @Description:
 * @Author: G
 * @Date: 2021-10-13 11:09:59
 * @LastEditTime: 2021-10-13 14:26:48
-->
<script setup lang="ts">
import { nextTick, ref } from "vue";
import { icons } from "../utils/data";
import axios from "axios";
import { parseSvg } from "@meta2d/svg";
import Meta2dTwoVue from "./Meta2dTwo.vue";

const onDragStart = (e: any, data) => {
  e.dataTransfer.setData("Meta2d", JSON.stringify(data));
};

nextTick(() => {
  // 此处只注册，未将数据放置到工具栏
  // data.ts 中配置的最后一项即为该图形库中的内容
  (window as any).registerToolsNew();
  (window as any).meta2dTools = undefined;
});

const rIcons = ref(icons);
axios.get("/T型开关A -C.svg").then((res) => {
  const data = res.data;
  const pens = parseSvg(data);
  rIcons.value.push({
    svg: "/T型开关A -C.svg",
    title: "svg",
    data: pens,
  });
});
</script>

<template>
  <div class="aside">
    <div class="icon-list">
      <div
        v-for="icon in rIcons"
        draggable="true"
        @dragstart="onDragStart($event, icon.data)"
        :title="icon.title"
      >
        <i v-if="icon.key" class="iconfont" :class="`icon-${icon.key}`"></i>
        <img
          v-else-if="icon.svg"
          :src="icon.svg"
          alt=""
          srcset=""
          class="img"
        />
      </div>
    </div>
    <div class="link">
      <a href="http://2ds.le5le.com/">去官网</a>
    </div>
    <Meta2dTwoVue /> 
  </div>
</template>

<style scoped>
.img {
  width: 100%;
  height: 100%;
}
</style>
