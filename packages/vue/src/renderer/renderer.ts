import {Meta2d, Pen, setLifeCycleFunc} from "@meta2d/core";
import {createRenderer} from 'vue';
import {getEventName, isEvent, isOnceEvent} from "../utils";
import {Meta2dContext} from "@meta2d/vue/src/types";

const rendererMeta2dMap = new WeakMap<Meta2d, any>();

const meta2dContextMap = new WeakMap<Meta2d, any>();

export function createMeta2dRenderer(meta2d: Meta2d, context: Meta2dContext) {

  if(rendererMeta2dMap.has(meta2d))return rendererMeta2dMap.get(meta2d);

  const renderer = createRenderer<Pen, Pen>({

    createElement(tag, namespace?, isCustomizedBuiltIn?,props?) {
      let element: Pen = null;
      element = meta2d.addPenSync({
        name:tag,
      });
      const id = element.id
      return element;
    },

    patchProp(pen:Pen, key, _prevValue, nextValue) {
      if(isEvent(key)){
        if(isOnceEvent(key)){ // 是once修饰符 暂不处理
          setLifeCycleFunc(pen,getEventName(key),nextValue);
        }else {
          setLifeCycleFunc(pen,getEventName(key),nextValue);
        }
        return;
      }
      meta2d.setValue({id:pen.id,[key]:nextValue});
    },

    insert(el, parent) {
    },

    remove(el) {
      meta2d.deleteSync([el]);
    },

    createText(node) {
      return {
        name:"text",
        x:0,
        y:0,
        width:0,
        height:0,
        visible:false
      };
    },

    createComment() {
      return {
        name:"text",
        x:0,
        y:0,
        width:0,
        height:0,
        visible:false
      };
    },

    setText() {},
    setElementText() {},

    parentNode(el) {
      if(el?.parentId) {
        return meta2d.findOne(el.parentId);
      }else return null
    },

    nextSibling(pen) {
      const children = meta2d.store.data.pens;
      const index = children.indexOf(pen);
      return index + 1 < children.length ? children[index + 1] : null
    },
  });
  rendererMeta2dMap.set(meta2d, renderer);
  return renderer;
}

export function createMeta2dContext(meta2d:Meta2d){
  if(meta2dContextMap.has(meta2d)) return meta2dContextMap.get(meta2d);
  const context: Meta2dContext = {
    pen: null,
    parent: null,
    group: false,
    prevContext: null
  };
  meta2dContextMap.set(meta2d, context)
  return context
}
