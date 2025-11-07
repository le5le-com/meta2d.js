import {
  defineComponent,
  h,
  markRaw,
  onMounted,
  onUnmounted,
  shallowRef,
  cloneVNode,
  getCurrentInstance, VNode
} from 'vue';
import {Meta2d} from "@meta2d/core";
import {useGetPropsByAttrs} from "./attr";
import {createMeta2dContext, createMeta2dRenderer} from "./renderer/renderer";
import {hackDirectives} from "./directives";
import {Meta2dContext} from "@meta2d/vue/src/types";

export const Meta2dComponent = defineComponent({

  setup(_props, {slots, expose, attrs}) {
    const dom = shallowRef<HTMLElement>();
    const meta2dInstance = shallowRef<Meta2d>();
    const {meta2dConf, eleConf} = useGetPropsByAttrs(attrs);

    function mount() {
      const meta2d = new Meta2d(dom.value, meta2dConf);

      meta2dInstance.value = markRaw(meta2d);

      const context = createMeta2dContext(meta2d);
      const renderer = createMeta2dRenderer(meta2d, context);

      const app = renderer.createApp({
        setup() {
          const instance = getCurrentInstance();

          function processVNode(vnode: any, parentContext = context): VNode {
            // 处理指令
            if (vnode.dirs && vnode.dirs.length > 0) {
              hackDirectives(meta2d, vnode.dirs);
            }

            if (vnode.ctx) {
              vnode.ctx.appContext = instance.appContext;
            }

            const currentContext:Meta2dContext = {
              pen: null,
              parent: parentContext.pen,
              group: false,
              prevContext: parentContext,
              subContext: [],
              x: parentContext.x,
              y: parentContext.y,
            };
            parentContext.subContext.push(currentContext);

            if(eleConf.inherit){
              if(vnode.props?.x != undefined) {
                vnode.props.x = currentContext.x + Number(vnode.props.x);
                currentContext.x = vnode.props.x;
              }else {
                vnode.props && (vnode.props.x = currentContext.x);
              }
              if (vnode.props?.y !== undefined) {
                vnode.props.y = currentContext.y + Number(vnode.props.y);
                currentContext.y = vnode.props.y;

              }else {
                vnode.props && (vnode.props.y = currentContext.y);
              }
            }else {
              currentContext.x = vnode.props?.x;
              currentContext.y = vnode.props?.y;
            }

            if (vnode.children) {
              if (Array.isArray(vnode.children)) {
                vnode.children = vnode.children.map((child) => {
                  if (typeof child === 'object' && child !== null && 'type' in child) {
                    return processVNode(child as VNode, currentContext);
                  }
                  return child;
                });
              } else if (typeof vnode.children === 'object') {
                const childrenObj = vnode.children as Record<string, any>;
                for (const key in childrenObj) {
                  const child = childrenObj[key];
                  if (typeof child === 'object' && child !== null && 'type' in child) {
                    childrenObj[key] = processVNode(child as VNode, currentContext);
                  } else if (Array.isArray(child)) {
                    // 处理 slots 中的数组情况
                    childrenObj[key] = child.map(item => {
                      if (typeof item === 'object' && item !== null && 'type' in item) {
                        return processVNode(item as VNode, currentContext);
                      }
                      return item;
                    });
                  }
                }
              }
            }

            if (vnode.component?.subTree) {
              processVNode(vnode.component.subTree, currentContext);
            }

            return vnode;
          }

          return () => {
            const vnodes = slots.default?.() || [];
            return vnodes.map((vnode) => processVNode(cloneVNode(vnode), context));
          };
        }
      });

      //@ts-ignore
      app.mount(dom.value);
    }

    function unMount() {
      meta2dInstance.value!.destroy();
    }

    onMounted(() => {
      mount();
    });

    onUnmounted(unMount);
    expose({meta2d: meta2dInstance});

    return () => h('div', {ref: dom});
  },
});
