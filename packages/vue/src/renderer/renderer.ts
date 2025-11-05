import { Meta2d, Pen} from "@meta2d/core"
import {camelize, createRenderer, markRaw, toRaw} from 'vue'
import {useMeta2d} from "./hooks/useMeta2d";
import { getCurrentInstance } from 'vue'


export const renderer = createRenderer<Pen, Pen>({
    createElement(tag, namespace?, isCustomizedBuiltIn?,props?) {
        let element: Promise<Pen>
        const instance = getCurrentInstance()
        const meta2d = useMeta2d()
        element = meta2d.meat2d.addPen({
            name:tag,
            ...toRaw(props)
        })
        return element as Pen
    },
    patchProp(el:Pen, key, _prevValue, nextValue) {
        const meta2d = useMeta2d();
        (el as Promise<Pen>).then((pen)=>{
            meta2d.meat2d.setValue({id:pen.id,[key]:nextValue})
        })
    },
    insert(el, parent) {
    },
    remove(el) {

    },
    createText(text) {
      return {}
    },
    createComment() {
      return {}
    },
    setText() {},
    setElementText() {},
    parentNode(node) {
      return {}
    },
    nextSibling(node) {
      return {}
    },
})
