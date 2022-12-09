<script setup lang="ts">
import { ref } from "vue";
import { Pen, Meta2d } from "@meta2d/core";
import data from "../assets/data/子画布.json";
let meta2dTwo: Meta2d;

const visible = ref(false);
const currentPen = ref<Pen>({});
const clickBtn = () => {
    visible.value = true;
    setTimeout(() => {
        if (!meta2dTwo) {
          meta2dTwo = new Meta2d("meta2dTwo");
          (window as any).meta2d= (window as any).mainMeta2d;
        }
        meta2dTwo.open(JSON.parse(JSON.stringify(data)));
        meta2dTwo.centerView();
    },1000);

}
</script>

<template>
  <div class="div-click">
    <a-button @click="clickBtn">子画布</a-button>
  </div>

  <a-modal v-model:visible="visible"  width="698px" :title="currentPen.text">
    <div class="meta2d-main">
      <div id="meta2dTwo"></div>
    </div>
  </a-modal>
</template>

<style scoped>
.div-click{
    width: 100%;
    text-align: center;
}
.meta2d-main{
    width: 650px;
    height: 500px;
   
}
#meta2dTwo{
height: 100%;
width: 100%;
}
</style>