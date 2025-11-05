# @meta2d/vue
Vue 声明式UI的方式使用meta2d，此库在开发中，暂不可用于生产环境

# example
```vue
<script setup lang="ts">
  import {Meta2dComponent} from "@meta2d/vue"
  import {onMounted, reactive} from "vue";

  const circleData = reactive({
    background:"#1376e4"
  })

  onMounted(()=>{
    setTimeout(()=>{
      circleData.background = '#00ff00'
      setTimeout(()=>{
        circleData.background = '#ff0000'
      },4000)
    },4000)
  })

</script>

<template>
  <div class="main">
    <Meta2dComponent style="width: 100%;height: 100%">
      <template v-for="row in 20" :key="row">
        <circle v-for="i in 10" :key="i"
                :text="i"
                :x="(row - 1) * 20 + 6"
                :y="(i - 1) * 20 + 6"
                :width="20"
                :height="20"
                :background="circleData.background"
        >
        </circle>
      </template>
    </Meta2dComponent>
  </div>
</template>
```
![example](./docs/images/meta2d-vue.gif)
