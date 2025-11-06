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

export const Meta2dComponent = defineComponent({

  setup(_props, { slots, expose, attrs }) {
    const dom = shallowRef<HTMLElement>();
    const meta2dInstance = shallowRef<Meta2d>();
    const config = useGetPropsByAttrs(attrs);

    function mount() {
      const meta2d = new Meta2d(dom.value, config);

      meta2dInstance.value = markRaw(meta2d);

      const context = createMeta2dContext(meta2d)
      const renderer = createMeta2dRenderer(meta2d, context);

      const app = renderer.createApp({
        setup() {
          const instance = getCurrentInstance();

          function processVNode(vnode: VNode): VNode {

            if (vnode.dirs && vnode.dirs.length > 0) {
              hackDirectives(meta2d, vnode.dirs);
            }

            const clonedNode:any = cloneVNode(vnode);

            if (clonedNode.ctx) {
              clonedNode.ctx.appContext = instance.appContext;
            }

            if (clonedNode.children) {
              if (Array.isArray(clonedNode.children)) {
                clonedNode.children = clonedNode.children.map((child) => {
                  if (typeof child === 'object' && child !== null && 'type' in child) {
                    return processVNode(child as VNode);
                  }
                  return child;
                });
              } else if (typeof clonedNode.children === 'object') {
                const childrenObj = clonedNode.children as Record<string, any>;
                for (const key in childrenObj) {
                  const child = childrenObj[key];
                  if (typeof child === 'object' && child !== null && 'type' in child) {
                    childrenObj[key] = processVNode(child as VNode);
                  }
                }
              }
            }

            if (clonedNode.component?.subTree) {
              processVNode(clonedNode.component.subTree);
            }

            return clonedNode;
          }

          return () => {
            const vnodes = slots.default?.() || [];
            return vnodes.map((vnode) => processVNode(vnode));
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
        expose({ app: meta2dInstance });

        return () => h('div', { ref: dom });
    },
});
