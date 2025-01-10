import {Pen, setElemPosition} from "@meta2d/core";
import Vue2meta2d from "../vue";
import {Component, Plugin, reactive} from 'vue'
import {ChartPen} from "@meta2d/chart-diagram";
interface VuePen extends Pen{
  vue: {
    component: Component,
    plugins: Plugin[]
    data:any,
    app:string
  },
  $el:HTMLElement
}

export function vueDom(pen:VuePen){
  const path = new Path2D()
  const worldRect = pen.calculative.worldRect;
  if (!pen.calculative.singleton) {
    pen.calculative.singleton = {};
  }
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = resize;
    pen.onRotate = move;
    // pen.onValue = value;
    // pen.onBeforeValue = beforeValue;
    // pen.onBinds = binds;
    // pen.onMouseEnter = move;
    // // pen.onAdd = onAdd;
    // pen.onRenderPenRaw = onRenderPenRaw;
    // pen.onScale = scale;
  }

  if (!pen.calculative.singleton.div) {
    // 1. 创建父容器
    const div = document.createElement('div');
    const vue2meta2d =Vue2meta2d
    const component = vue2meta2d.VueComponentMap.get(pen.vue.component)
    const app = pen.vue.app && vue2meta2d.VueAppMap.get(pen.vue.app)
    div.style.position = 'absolute';
    div.style.outline = 'none';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.width = worldRect.width + 'px';
    div.style.height = worldRect.height + 'px';
    document.body.appendChild(div);
    // 2. 加载到div layer
    pen.calculative.canvas.externalElements?.parentElement.appendChild(div);
    setElemPosition(pen, div);
    pen.calculative.singleton.div = div;
    pen.vue.data = reactive(pen.vue.data)
    pen.calculative.singleton.vm = vue2meta2d.parse(component,{pen,data:pen.vue.data,meta2d:(window as any).meta2d},app || pen.vue.component,div);
    if(!pen.vue.app)pen.calculative.singleton.vm.mount(div)
  }
  return path;
}
function destory(pen: Pen) {
  if (pen.calculative.singleton && pen.calculative.singleton.div) {
    pen.calculative.singleton.div.remove();
    delete pen.calculative.singleton.div;
  }
}

function move(pen: Pen) {
  pen.calculative.singleton.div &&
  setElemPosition(pen, pen.calculative.singleton.div);
}

function resize(pen: ChartPen) {
  move(pen);
  if (!pen.calculative.singleton?.echart) {
    return;
  }
  pen.calculative.singleton.echart.resize();
}
