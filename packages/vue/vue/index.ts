import {createApp, compile, App, h, render, defineAsyncComponent, defineComponent, warn} from "vue"
import { loadModule } from 'vue3-sfc-loader'

export enum VueMode {
  PACK, // 打包环境 支持复杂的vue文件
  SFC , //普简单sfc文件 支持简单的sfc文件 依赖vue3-sfc-loader
  COM, // 通过defineComponent方式定义组件 需要全部由defineComponent定义
}
type Config = {
  mode: number
}
class Vue2Meta2d {
  config:{
    mode: VueMode
  }
  VueAppMap = new Map()
  VuePluginsMap = new Map()
  VueComponentMap = new Map()

  constructor(config:Config) {
    this.config = {
      mode:0
    }
    Object.assign(this.config,config)
  }
  parse(component:any, props:any,app?: any, dom?:string | HTMLElement){
    let _app = null
    switch (this.config.mode){
      case VueMode.PACK: // 若为构建工具模式sfc文件
        _app = this.packEnv(component,props,app,dom)
        break
      case VueMode.SFC: // 若为构普通sfc文件
        _app = this.sfcEnv(component,props,app,dom)
        break
      case VueMode.COM: // 若为defineComponent方式定义组件

        break
    }
    return _app
  }
  registerVueComponent(name:string,component:any){
    if(this.VueComponentMap.has(component)){
      return console.warn('组件已存在')
    }
    this.VueComponentMap.set(name,component)
  }
  registerVueApp(name:string,app:App){
    if(this.VueAppMap.has(name)){
      return console.warn('app上下文已存在')
    }
    this.VueAppMap.set(name,app)
  }

  registerVuePlugins(name:string,plugins:any){
    if(this.VuePluginsMap.has(plugins)){ // @bug 插件永远不会重复
      return console.warn('插件已存在')
    }
    this.VuePluginsMap.set(name,plugins)
  }
  packEnv(component: any, props?: any, app?: App, dom?: string | HTMLElement) {
    if(app && !dom)return warn('@meta2d/vue指定app参数时dom参数不能为空')
    return typeof app === "object" ?
      this.createVueFromApp(app,component,props,dom) :
      this.createVueNoContext(app,component,props)
  }
  sfcEnv(component: string, props?: any, app?: App, dom?: string | HTMLElement){
    let com = null
    if(component.startsWith('.') || component.startsWith('/')){// 若component为组件的文件路径
      const options:any = {
      }
      com = defineAsyncComponent(()=>loadModule(component,options))
    }

  return this.createVueNoContext(com,props)
  }

  comEnv(component: any, props?: any, app?: App, dom?: string | HTMLElement){

  }

  createVueNoContext(name:string,component:any,props?:any) {
    //TODO component 目前仅考虑为vue组件的情况，sfc文件目前还不支持

    // if(typeof component === "string" && (component.startsWith('.') || component.startsWith('/'))){  // component可能是个路径或者组件文本 const options = {
    //   const config = {
    //     files: {
    //
    //       // note: Here, for convenience, we simply retrieve content from a string.
    //
    //       '/main.vue': {
    //         getContentData: () => /* <!-- */`
    //         <template>
    //           <pre><b>'url!./circle.svg' -> </b>{{ require('url!./circle.svg') }}</pre>
    //           <img width="50" height="50" src="~url!./circle.svg" />
    //           <pre><b>'file!./circle.svg' -> </b>{{ require('file!./circle.svg') }}</pre>
    //           <img width="50" height="50" src="~file!./circle.svg" /> <br><i>(image failed to load, this is expected since there is nothing behind this url)</i>
    //         </template>
    //       `/* --> */,
    //         type: '.vue',
    //       },
    //       '/circle.svg': {
    //         getContentData: () => /* <!-- */`
    //         <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    //           <circle cx="50" cy="50" r="50" />
    //         </svg>
    //       `/* --> */,
    //         type: '.svg',
    //       }
    //     }
    //   };
    //   const options = {
    //     moduleCache: {
    //       'vue': Vue,
    //       'file!'(content, path, type, options) {
    //
    //         return String(new URL(path, window.location));
    //       },
    //       'url!'(content, path, type, options) {
    //
    //         if ( type === '.svg' )
    //           return `data:image/svg+xml;base64,${ btoa(content) }`;
    //
    //         throw new Error(`${ type } not handled by url!`);
    //       },
    //     },
    //     handleModule(type, getContentData, path, options) {
    //
    //       switch (type) {
    //         case '.svg': return getContentData(false);
    //         default: return undefined; // let vue3-sfc-loader handle this
    //       }
    //     },
    //     getFile(url, options) {
    //
    //       return config.files[url] || (() => { throw new Error('404 ' + url) })();
    //     },
    //     getResource({ refPath, relPath }, options) {
    //
    //       const { moduleCache, pathResolve, getFile } = options;
    //
    //       // split relPath into loaders[] and file path (eg. 'foo!bar!file.ext' => ['file.ext', 'bar!', 'foo!'])
    //       const [ resourceRelPath, ...loaders ] = relPath.match(/([^!]+!)|[^!]+$/g).reverse();
    //
    //       // helper function: process a content through the loaders
    //       const processContentThroughLoaders = (content, path, type, options) => {
    //
    //         return loaders.reduce((content, loader) => {
    //
    //           return moduleCache[loader](content, path, type, options);
    //         }, content);
    //       }
    //
    //       // get the actual path of the file
    //       const path = pathResolve({ refPath, relPath: resourceRelPath }, options);
    //
    //       // the resource id must be unique in its path context
    //       const id = loaders.join('') + path;
    //
    //       return {
    //         id,
    //         path,
    //         async getContent() {
    //
    //           const { getContentData, type } = await getFile(path);
    //           return {
    //             getContentData: async (asBinary) => processContentThroughLoaders(await getContentData(asBinary), path, type, options),
    //             type,
    //           };
    //         }
    //       };
    //     },
    //     addStyle() { /* unused here */ },
    //   }
    //   _ = defineAsyncComponent(()=>loadModule(component,options))
    // }

    const app = createApp(component,props) // 单独创建一个vue实例  TODO 能否复用app？
    this.installVuePlugins(app,this.VuePluginsMap.get(name))
    return app
  }

  createVueFromApp(app: any,component:any, props:any, dom?:string | HTMLElement) {
    this.setAppRender(app)
    return app.render(component,props,dom)
  }

  installVuePlugins(app:any,plugins:any[]){
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

      // Creating a wrapper element here is clunky and ideally wouldn't be necessary
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
