<script setup lang="ts">
import { ref } from "vue";
import { Pen, Topology } from "@topology/core";
import data from "../assets/data/子画布.json";
let topologyTwo: Topology;

const visible = ref(false);
const currentPen = ref<Pen>({});
const clickBtn = () => {
    visible.value = true;
    setTimeout(() => {
        if (!topologyTwo) {
          topologyTwo = new Topology("topologyTwo");
          (window as any).topology= (window as any).mainTopology;
        }
        topologyTwo.open(JSON.parse(JSON.stringify(data)));
        topologyTwo.centerView();
    },1000);

}
</script>

<template>
  <div class="div-click">
    <a-button @click="clickBtn">子画布</a-button>
  </div>

  <a-modal v-model:visible="visible"  width="698px" :title="currentPen.text">
    <div class="topology-main">
      <div id="topologyTwo"></div>
    </div>
  </a-modal>
</template>

<style scoped>
.div-click{
    width: 100%;
    text-align: center;
}
.topology-main{
    width: 650px;
    height: 500px;
   
}
#topologyTwo{
height: 100%;
width: 100%;
}
</style>