import { DefineComponent } from 'vue'

declare module 'vue' {
    export interface GlobalComponents {
        circle: DefineComponent<{ x: number; y: number; text: string }>
        square: DefineComponent<{ x: number; y: number; text: string }>
        Meta2dComponent: typeof import('../index')['Meta2dComponent']
    }
}