import {facePen, Meta2d, Pen, setLifeCycleFunc} from "@meta2d/core";
import {camelize, createRenderer, markRaw, toRaw, inject} from 'vue';
import {getEventName, isEvent, isOnceEvent} from "../utils";

const rendererMeta2dMap = new WeakMap<any, Meta2d>();

export function createMeta2dRenderer(meta2d: Meta2d) {
  const renderer = createRenderer<Pen, Pen>({
    createElement(tag, namespace?, isCustomizedBuiltIn?,props?) {
      let element: Pen = null;
      element = meta2d.addPenSync({
        name:tag,
      });
      return element;
    },
    patchProp(pen:Pen, key, _prevValue, nextValue) {
      console.log(key, _prevValue, nextValue,'patchProp');
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
      console.log(el,'remove');
      const a =meta2d.deleteSync([el]);
      console.log(a);
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
      }else {
        return {
          name:"text",
          x:0,
          y:0,
          width:0,
          height:0,
          visible:false
        };
      }
    },
    nextSibling(pen) {
      const children = meta2d.store.data.pens;
      const index = children.indexOf(pen);
      return index + 1 < children.length ? children[index + 1] : null
    },
  });
  rendererMeta2dMap.set(renderer,meta2d );
  return renderer;
}
