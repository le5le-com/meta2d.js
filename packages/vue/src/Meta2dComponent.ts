import { defineComponent, h, markRaw, onMounted, onUnmounted, renderSlot, shallowRef } from 'vue'
import {Meta2d, Pen} from "@meta2d/core";
import {createApp} from "./renderer";
import {useGetPropsByAttrs} from "./attr";
import {useMeta2d} from "./renderer/hooks/useMeta2d";

export const Meta2dComponent = defineComponent({
    setup(_props, { slots, expose, attrs }) {
        const dom = shallowRef<HTMLElement>()
        const meta2dInstance = shallowRef<Meta2d>()
        const config = useGetPropsByAttrs(attrs)
        function mount() {
            const meta2d = useMeta2d(dom.value,config)
            meta2dInstance.value = markRaw(meta2d.meat2d)
            const app = createApp({
                render: () => renderSlot(slots, 'default'),
            })
          //@ts-ignore
            app.mount(dom.value)
        }

        function unMount() {
            meta2dInstance.value!.destroy()
        }

        onMounted(() => {
            mount()
        })

        onUnmounted(unMount)
        expose({ app: meta2dInstance })

        return () => h('div', { ref: dom })
    },
})
