import type { Directive } from 'vue'
import {Meta2d, Pen} from "@meta2d/core";

export function patchVShow(meta2d,dir) {
  dir.dir = createVshowDirective(meta2d)
  dir.dir.name = 'show'
}
 function createVshowDirective(meta2d:Meta2d):Directive {
  const customVShow:Directive = {
    mounted(el){
    },
    beforeMount(el:Pen, { value }, vnode) {
      setDisplay(meta2d, el, value)
    },
    updated(el:Pen, { value }, vnode) {
      setDisplay(meta2d, el, value)
    },
    beforeUpdate(el:Pen, { value, oldValue }, vnode) {
      if (value !== oldValue) {
        setDisplay(meta2d, el, value)
      }
    }
  }
  return customVShow
}


function setDisplay(meta2d:Meta2d, el:Pen, value:boolean) {
  debugger
  meta2d.setValue({
    id:el.id,
    visible:value
  })
}
