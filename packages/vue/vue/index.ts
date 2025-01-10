import {createApp, App, h, render, defineAsyncComponent, warn, Component} from "vue"
import * as Vue from 'vue'
import { loadModule } from 'vue3-sfc-loader'

export enum VueMode {
  PACK, // 打包环境 支持复杂的vue文件
  SFC , //普简单sfc文件 支持简单的sfc文件 依赖vue3-sfc-loader
  COM, // 通过defineComponent方式定义组件 需要全部由defineComponent定义
}
type Config = {
  mode: number
}
type ComponentApp = App & {
  render: (Component: any, props?: any, dom?: string | HTMLElement) => any;
  unrender: (vm: any) => void;
}

type ComponentConfig = {
  component: string | Component,  // 需要渲染的组件
  mode?: VueMode,
  props:{}, // 传递给组件的prop属性
  app?: ComponentApp, // 需要渲染组件到哪个上下文，若不设置，会新创建一个app上下文
  plugins?:any[], // 上下文依赖的插件
  modules?:{
    [key: string]: any,
  }, // 组件依赖的包
  files?:{ // 组件依赖的文件
    [key:string]:{
      getContentData: () => string,
      type: string
    }
  },
  options:{} // 对于vue3-sfc-loader的扩展配置
}


class Vue2Meta2d {
  config:{
    mode: VueMode
  }
  VueComponentMap = new Map()

  constructor(config:Config) {
    this.config = {
      mode:0
    }
    Object.assign(this.config,config)
  }
  async parse(componentName:string,props:any = {}, dom?:string | HTMLElement){
    const componentConfig = this.VueComponentMap.get(componentName) // 获取组件配置

    if({}.toString.call(props) !== '[object Object]')console.error('@meta2d/vue props参数必须为对象')

    let _app = null
    switch (componentConfig.mode){
      case VueMode.PACK: // 若为构建工具模式sfc文件
        _app = this.packEnv(componentConfig,props,dom)
        break
      case VueMode.SFC: // 若为构普通sfc文件
        _app = await this.sfcEnv(componentConfig,props,dom)
        break
      case VueMode.COM: // 若为defineComponent方式定义组件
        _app = this.comEnv(componentConfig,props,dom)
        break
    }
    return _app
  }


  registerVueComponent(name:string,componentConfig:ComponentConfig){
    componentConfig.mode ??= 0
    componentConfig.props ??= {}
    if(this.VueComponentMap.has(componentConfig)){
      return console.warn('组件已存在')
    }
    this.VueComponentMap.set(name,componentConfig)
  }

  packEnv(componentConfig: ComponentConfig,props:any, dom?: string | HTMLElement) {
    const app = componentConfig.app // 指定app上下文
    if(typeof app === 'object' && !dom)return warn('@meta2d/vue指定app参数时dom参数不能为空')
    if(typeof componentConfig.component === 'string') return console.error('@meta2d/vue','@meta2d/vue在cli环境下component参数必须为组件对象')
    return typeof app === "object" ?
      this.createVueFromApp(componentConfig,props,dom) :
      this.createVueNoContext(componentConfig,props)
  }
  async sfcEnv(componentConfig: ComponentConfig,props:any,dom?: string | HTMLElement){
    const config = {
      files:componentConfig.files
    };

    const options = {
      moduleCache: {
        vue: Vue,
      },
      getFile: async (url) => {
        return config[url] || fetch(url).then(res => res.text());
      },
      addStyle(textContent) {

        const style = Object.assign(document.createElement('style'), { textContent });
        const ref = document.head.getElementsByTagName('style')[0] || null;
        document.head.insertBefore(style, ref);
      },
      ...componentConfig.options
    }
    if(typeof componentConfig.component ==='string' && (componentConfig.component.startsWith('/') || componentConfig.component.startsWith('.'))){
      return await loadModule(componentConfig.component, options)
        .then(component => {
          componentConfig.component = component
          return componentConfig.app?
            this.createVueFromApp(componentConfig, props,dom) :
            this.createVueNoContext(componentConfig,props)
        })
    }

    const com = defineAsyncComponent(() => loadModule(componentConfig.component, options))
    componentConfig.component = com

    return componentConfig.app?
      this.createVueFromApp(componentConfig, props,dom) :
      this.createVueNoContext(componentConfig)
  }

  comEnv(component: any, props?: any, app?: App, dom?: string | HTMLElement){
    return componentConfig.app?
      this.createVueFromApp(componentConfig, props,dom) :
      this.createVueNoContext(componentConfig)
  }

  createVueNoContext(componentConfig:ComponentConfig,props:any) {
    //TODO component 目前仅考虑为vue组件的情况，sfc文件目前还不支持
    if(componentConfig.component ==='string')return console.error('@meta2d/vue在cli环境下component参数必须为组件对象')
    const app = createApp(componentConfig.component,props) // 单独创建一个vue实例
    this.installVuePlugins(app,componentConfig.plugins)
    return app
  }

  createVueFromApp(componentConfig:ComponentConfig,props:any, dom?:string | HTMLElement) {
    this.setAppRender(componentConfig.app)
    const app = componentConfig.app.render(componentConfig.component,props,dom)
    return app
  }

  installVuePlugins(app:any,plugins:any[] = []){
    plugins.forEach(i=>{
      app.use(i)
    })
  }

// 设置app的render函数
  setAppRender(app) {
    !app.render && (app.render = function(Component, props, el) {
      if (typeof el === 'string') {
        el = document.querySelector(el)
      }

      if (!el) {
        throw new Error('el not found')
      }

      if (props && {}.toString.call(props) !== '[object Object]') {
        throw Error('props must be an object')
      }

      const childTree = h(Component, props)
      childTree.appContext = app._context

      const div = document.createElement('div')
      el.appendChild(div)

      render(childTree, div)

      return childTree.component.proxy
    })
    !app.unrender && (app.unrender = function (vm) {
      const el = vm.$el.parentNode

      render(null, el)

      el.parentNode.removeChild(el)
    })
  }
}

export default new Vue2Meta2d({mode:0})
