// 模板解析，注册函数并返回返回dom对象
// TODO 此处只能处理返回字符串的信息
const EVENTTAG = ['@', 'on'];

import {
  compareObjects,
  createDom,
  deepCopy,
  error,
  escapeRegExp,
  removeDuplicates,
  replaceAfterPosition,
  scopedEval,
} from './utils';

let LifeCycle = ['init', 'mounted'];

/**
 * @description 通过此函数你可以自由地自定义工具栏的样式 采用影子dom 使得style相互隔离
 * @param self 此配置项自身
 * @return string dom字符串
 * @param config
 * @param output
 * @param root
 * @param oldScript
 * */
interface ScriptType {
  $update?: any;

  [key: string]: any;
}

let env = Symbol('env');

export function Scope(
  config: any,
  {
    template = '',
    script = {},
    style = '',
  }: {
    template: string;
    script?: ScriptType;
    style?: string;
  },
  output = 'dom',
  root?: HTMLElement,
  oldScript?: any
) {
  let res: any = createDom('div');
  let namespace = config.key;
  window[env] ? '' : (window[env] = {});
  window[env][namespace] ? '' : (window[env][namespace] = {});
  let symbols = Object.getOwnPropertySymbols(window);
  let targetSymbol: number;
  for (let i = 0; i < symbols.length; i++) {
    let symbol = symbols[i];
    if (window[symbol] === window[env]) {
      targetSymbol = i;
      break;
    }
  }

  if (!namespace)
    error('Scope', 'The config parameter is invalid [have no key]');
  let duty = [];
  // dom的预处理
  template = addUniqueIdsToHtmlString(template);

  script.$update = () => {
    if (!root) root = res;
    // duty.forEach(key=>{
    //     // 找到对应的dom
    //     let changes = window[env][namespace].__depMap.filter((v)=>{
    //         // 返回表达式中包含此变量的表达式
    //         return v.name.includes(key)
    //     })
    //     let globalRender = false
    //     let textIndex = 0
    //     changes.forEach((i)=>{
    //         let res = scopedEval(window[env][namespace],i.name)
    //         const element = document.querySelector(`[data-meta2d-id="${i['meta2d-id']}"]`);
    //         if(i.prop === 'class' ){
    //             let res =
    //             // TODO 这没换成功
    //             element.classList.remove(i.res)
    //             element.classList.add(res)
    //         }else if (i.prop === 'style'){
    //             // 将表达式放进沙盒执行得到返回结果
    //             element.style[i.styleProp] = res
    //             // root.innerHTML = Scope(config,{template,style,script:window[env][namespace]},output,root,oldScript).innerHTML
    //         }else if(i.prop === 'textContent'){
    //             // 若为第1个textContent
    //             if(!textIndex){
    //                 element.textContent = i.textContent
    //                 textIndex ++
    //             }
    //             i.textContent = element.textContent
    //             element.textContent = i.textContent.replace(i.originTemp,res)
    //             // i.textContent = res
    //         } else {
    //             globalRender = true
    //         }
    //     })
    //     globalRender ? root.innerHTML = Scope(config,{template,style,script:window[env][namespace]},output,root,oldScript).innerHTML: ''
    // })
    // 组件全部更新
    root!.innerHTML = Scope(
      config,
      {
        template,
        style,
        script: window[env][namespace],
      },
      output,
      root,
      oldScript
    ).innerHTML;
    duty = [];
  };
  // 代理模式查找更改数据项
  let proxyScript: any = createDeepProxy(script, (p: string, v: any) => {
    if (!['$update', 'init', 'mounted', '__depMap'].includes(p)) {
      if (p.includes('.')) {
        p = p.split('.')[0];
      }
      duty.push(p);
    }
  });
  window[env] ? '' : (window[env] = {});
  window[env][namespace] ? '' : (window[env][namespace] = {});
  let { dom, funcObjs, varObj } = parse(template);
  let keys = Object.keys(script);

  window[env][namespace] = proxyScript;
  window[env][namespace].__depMap = null;

  // 生命周期
  if (!root) {
    proxyScript.init?.();
    Promise.resolve().then(() => {
      proxyScript.mounted?.(res);
    });
  }
  let funcOffset = 0;

  funcObjs.forEach((i) => {
    // 出现的函数在script中定义了 则转换
    if (keys.indexOf(i.name) !== -1) {
      // 处理函数传参的变量
      i.params.forEach((j: any) => {
        //TODO 应该还要过滤一遍字面量  此处仅仅处理了变量
        if (
          !j.param.startsWith('this') &&
          j.param !== 'event' &&
          !isLiteral(j.param)
        ) {
          // TODO 此处应当根据字符的具体位置来替换，而非全部替换
          // dom = dom.replaceAll(j.param,`meta2dPluginManager._env.${namespace}.${j}`)
          let oldDom = dom;

          dom = replaceAfterPosition(
            dom,
            j.index - funcOffset,
            j.param,
            `window[Object.getOwnPropertySymbols(window)[${targetSymbol}]].${namespace}.${j.param}`
          );
          funcOffset += oldDom.length - dom.length; // 更换后的文字偏移量
        }
      });
      // 处理函数名
      dom = dom.replaceAll(
        i.name + '(',
        `window[Object.getOwnPropertySymbols(window)[${targetSymbol}]].${namespace}.${i.name}(`
      );
    }
  });
  window[env][namespace].__depMap = varObj;
  varObj.forEach((i: any) => {
    // 支持简单的表达式
    let res = scopedEval(window[env][namespace], i.name);
    // 将生成的结果保存在数据中
    i.res = res;
    // 进行运算后的值替换
    let regex = new RegExp(`\\{\\{\\s*${escapeRegExp(i.name)}\\s*\\}\\}`);
    dom = replaceAfterPosition(dom, 0, regex, res);
  });

  let sty = '';
  if (style) {
    style.startsWith('<style>')
      ? (sty = style)
      : (sty = `<style>${style}</style>`);
  }
  if (output === 'string') {
    return dom + sty;
  } else if (output === 'dom') {
    res.innerHTML = dom + sty;
    res.expose = proxyScript;
    return res;
  }
}

function parse(html: string) {
  // 函数匹配式
  let funcReg = new RegExp(
    `(${EVENTTAG.join(
      '|'
    )})(?<event>\\w+)\\s*=\\s*["'](?<name>[a-zA-Z][a-zA-Z0-9]*)\\s*\\(\\s*(?<param>[^)]*)\\s*\\)["']`,
    'g'
  );
  // 变量匹配
  let reHtml = html
    .replaceAll('\n', '')
    .replaceAll(/@(\w+)="([^"]+)"/g, 'on$1="$2"');

  // 使用 matchAll 来匹配所有结果
  let funcMatchs: any = reHtml.matchAll(funcReg);
  let varParseObj = variableParse(html);

  // 请注意，没有传递 'g' 标志给 matchAll，因为 reg 已经带有 'g' 标志

  let result = [];
  for (let match of funcMatchs) {
    let { event, name, param } = match.groups;

    // 获取参数的具体位置

    let params = param.replaceAll(/\s/g, '').split(',');
    let lastIndex = 0;
    params = params.map((i: string) => {
      let strIndex = match[0].indexOf(i, lastIndex);
      let index = match.index + strIndex;
      lastIndex = strIndex + i.length;
      return {
        param: i,
        index,
      };
    });
    // 去除 param 中的空格并按逗号分割参数
    let re = { event, name, params, index: match.index };
    result.push(re);
  }

  // 去重逻辑
  let funcObjs = removeDuplicates(result);
  // let varObj = removeDuplicates(varResult)
  return { dom: reHtml, funcObjs, varObj: varParseObj };
}

function parseHtmlString(html: string) {
  let parser = new DOMParser();
  let doc = parser.parseFromString(html, 'text/html');
}

// 该数据是否为字面量
function isLiteral(_: string) {
  // 判断是否为字符串
  if (_.startsWith('"') || _.startsWith("'")) return true;
  // 判断是否为数字
  // if(typeof (+ _) === "number")return true
  if (!Number.isNaN(+_)) return true;

  if (_ === 'true' || _ === 'false') return true;

  // 还未考虑是否为对象
  return false;
}

// 解析变量表达式
// TODO  该解释器不支持嵌套使用，是否应当使用DomPaser进行解析替换传统正则替换？？
function variableParse(html: string) {
  const results = [];
  // 匹配标签以及标签中的属性
  const tagRegex = /<\s*[\w-]+.*?>[\s\S]*?<\/[\w-]+>/g;
  // 匹配单独的属性
  const attributeRegex = /(\w+)\s*=\s*(['"])(.*?)\2/g;
  // 匹配双花括号中的变量
  const variableRegex = /{{\s*([\w.+\-? :()']*)\s*}}/g;

  let tagMatch;
  while ((tagMatch = tagRegex.exec(html)) !== null) {
    const tag = tagMatch[0];
    let meta2dIdMatch = tag.match(/data-meta2d-id=['"]([\d|\w]+)['"]/);
    let meta2dId = meta2dIdMatch ? meta2dIdMatch[1] : undefined;

    let attributeMatch;
    while ((attributeMatch = attributeRegex.exec(tag)) !== null) {
      const attributeName = attributeMatch[1];
      const attributeValue = attributeMatch[3];
      let variableMatch;
      while ((variableMatch = variableRegex.exec(attributeValue)) !== null) {
        const variableName = variableMatch[1];
        if (attributeName === 'style') {
          const styleAttributeRegex =
            /\s*(?<prop>[\w-]+)\s*:\s*{{\s*([^{}]+)\s*}};?/g;
          let stylePropMatch;
          while (
            (stylePropMatch = styleAttributeRegex.exec(attributeValue)) !== null
          ) {
            const styleProp = stylePropMatch[1];
            const styleValue = stylePropMatch[2];
            if (
              results.findIndex((i) => {
                return (
                  i.styleProp === styleProp &&
                  i['meta2d-id'] === meta2dId &&
                  i.name === styleValue
                );
              }) > -1
            )
              continue;
            results.push({
              prop: 'style',
              styleProp,
              'meta2d-id': meta2dId,
              name: styleValue,
            });
          }
        } else {
          results.push({
            prop: attributeName,
            name: variableName,
            'meta2d-id': meta2dId,
          });
        }
      }
    }

    // 检查标签内部的文本内容中的变量
    let textContent = tag.replace(/<[\s\S]*?>/g, ''); // 移除标签，仅保留文本内容
    let variableMatch;
    while ((variableMatch = variableRegex.exec(textContent)) !== null) {
      const variableName = variableMatch[1];
      results.push({
        prop: 'textContent',
        name: variableName,
        textContent,
        originTemp: variableMatch[0],
        'meta2d-id': meta2dId,
      });
    }
  }
  return results;
}

function addUniqueIdsToHtmlString(htmlString: string) {
  // 解析HTML字符串为DOM对象
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // 生成UUID的辅助函数
  function generateUUID() {
    return 'xxxxxxxxxxxxxxxxxxxx'.replace(/[x]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // 递归函数用于遍历并为每个元素添加唯一ID
  function addUniqueIdToElement(element: any) {
    if (element.nodeType === 1) {
      // Element节点
      element.setAttribute('data-meta2d-id', generateUUID());
      Array.from(element.children).forEach(addUniqueIdToElement);
    }
  }

  // 开始遍历并添加唯一ID
  addUniqueIdToElement(doc.body);

  // 将更新后的DOM对象转换回字符串
  const serializer = new XMLSerializer();
  let newHtmlString: any = serializer.serializeToString(doc);

  // 清除可能的编码问题
  newHtmlString = newHtmlString.replaceAll(/\?&quot;/g, '"'); // 这里替换 '?&quot;' 为正常的双引号

  // 由于serializeToString会包括整个HTML文档，我们需要提取body部分
  const bodyContent = newHtmlString.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];
  return bodyContent;
}

function createDeepProxy(
  obj: any,
  onChange: Function,
  path: any[] = []
): Promise<any> {
  return new Proxy(obj, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value === 'object' && value !== null) {
        return createDeepProxy(value, onChange, [...path, key]); // 递归代理子属性
      }
      return value;
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      onChange([...path, key].join('.'), value); // 传递属性路径
      return result;
    },
  });
}
