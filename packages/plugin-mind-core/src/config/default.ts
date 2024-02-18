import {createDom} from "../utils";
import {mindBoxPlugin} from "../core";
import {Scope} from "../parse";
import {Meta2d, Pen} from "@meta2d/core";
declare const meta2d:Meta2d;
export let colorList = ['#FF2318', '#9C64A2', '#B4C926', '#0191B3',
  '#6F6EB9', '#9C64A2', '#FF291B', '#F4AE3C'];

export interface FuncOption {
  key: string;
  description?: string;
  menu: {
    text?: string,
    icon?: string,
    img?: string,
    dom: (self: FuncOption, pen: Pen, dom: HTMLElement) => string | HTMLElement
  };
  popup?: any[] | ((self: FuncOption, pen: Pen, dom: HTMLElement) => (string | HTMLElement));
  popupEvent?: string;
  shadowRoot?: boolean;
  collapseEventOnMenu?: boolean;
  stopPropagation?: boolean;

  [key: string]: any;
}


export function* generateColor(colorList?: string[]) {
  if (colorList && !Array.isArray(colorList)) {
    console.warn('mindBoxPlugin warn: generateColor must take array param');
  }
  let index = 0;
  let list = colorList || mindBoxPlugin.colorList;
  while (true) {
    yield list[index];
    index = (index + 1) % list.length;
  }
}

export let funcList =
  [
    //   {
    // key: "id",
    //     name:'id',
    // setDom(self,pen) {
    //   return pen.id
    // }
    //   },
    {
      key: 'addChildNode',
      description: '用于新增子节点',
      menu: {
        text: '新增子级节点',// 该选项的选项名，当无icon或者img或者setDom时，会以此为准  优先级：setDom>icon>img>name
        img: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMzRweCIgaGVpZ2h0PSIzNHB4IiB2aWV3Qm94PSIwIDAgMzQgMzQiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8dGl0bGU+5LiL57qn6IqC54K5PC90aXRsZT4KICAgIDxkZWZzPgogICAgICAgIDxyZWN0IGlkPSJwYXRoLTEiIHg9IjE0IiB5PSIxOCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjciIHJ4PSIxIj48L3JlY3Q+CiAgICAgICAgPG1hc2sgaWQ9Im1hc2stMiIgbWFza0NvbnRlbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIG1hc2tVbml0cz0ib2JqZWN0Qm91bmRpbmdCb3giIHg9IjAiIHk9IjAiIHdpZHRoPSIxNiIgaGVpZ2h0PSI3IiBmaWxsPSJ3aGl0ZSI+CiAgICAgICAgICAgIDx1c2UgeGxpbms6aHJlZj0iI3BhdGgtMSI+PC91c2U+CiAgICAgICAgPC9tYXNrPgogICAgPC9kZWZzPgogICAgPGcgaWQ9Iumhtemdoi0xIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8ZyBpZD0i5Zu65a6aIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMzM2LjAwMDAwMCwgLTI3LjAwMDAwMCkiPgogICAgICAgICAgICA8ZyBpZD0i57yW57uELTLlpIfku70iIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE4Mi4wMDAwMDAsIDI0LjAwMDAwMCkiPgogICAgICAgICAgICAgICAgPGcgaWQ9IuS4i+e6p+iKgueCuSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTU0LjAwMDAwMCwgMy4wMDAwMDApIj4KICAgICAgICAgICAgICAgICAgICA8cmVjdCBpZD0i6YCP5piO5bqV5Zu+IiBmaWxsLW9wYWNpdHk9IjAiIGZpbGw9IiNGRkZGRkYiIHg9IjAiIHk9IjAiIHdpZHRoPSIzNCIgaGVpZ2h0PSIzNCI+PC9yZWN0PgogICAgICAgICAgICAgICAgICAgIDxyZWN0IGlkPSLnn6nlvaLlpIfku70tNiIgc3Ryb2tlPSIjODE4MTg3IiB4PSI0LjUiIHk9IjguNSIgd2lkdGg9IjE1IiBoZWlnaHQ9IjYiIHJ4PSIxIj48L3JlY3Q+CiAgICAgICAgICAgICAgICAgICAgPGxpbmUgeDE9IjEyIiB5MT0iMjIiIHgyPSIxNCIgeTI9IjIyIiBpZD0i55u057q/LTciIHN0cm9rZT0iIzgxODE4NyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj48L2xpbmU+CiAgICAgICAgICAgICAgICAgICAgPGxpbmUgeDE9IjEyIiB5MT0iMTUiIHgyPSIxMiIgeTI9IjIyIiBpZD0i55u057q/LTYiIHN0cm9rZT0iIzgxODE4NyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj48L2xpbmU+CiAgICAgICAgICAgICAgICAgICAgPHVzZSBpZD0i55+p5b2i5aSH5Lu9LTUiIHN0cm9rZT0iIzlDOUNBNSIgbWFzaz0idXJsKCNtYXNrLTIpIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1kYXNoYXJyYXk9IjIiIHhsaW5rOmhyZWY9IiNwYXRoLTEiPjwvdXNlPgogICAgICAgICAgICAgICAgPC9nPgogICAgICAgICAgICA8L2c+CiAgICAgICAgPC9nPgogICAgPC9nPgo8L3N2Zz4=',
      },   // 监听事件名
      // event: 'click',
      /**
       * @description 事件对应的回调函数
       * @param self 返回该选项自身
       * @param pen 返回当前操作的pen对象
       * */
      // func: async (self,pen)=>{
      //   mindBoxPlugin.bottomChildren(pen,0);
      //   },
      popupEvent: 'mouseenter',
      shadowRoot: false,
      collapseEventOnMenu: false, // 是否在childrenDom中触发事件
      stopPropagation: true,
      collapseAnimate(self: any, pen: any, dom: HTMLElement) {
        // dom.style.height = 'max-height'
        // dom.style.visibility = 'hidden'
        // dom.style.overflow = 'hidden'
        // dom.style.transition = '.3s'
        // dom.style.height = 0'
        dom.style.transformOrigin = 'top';
        dom.offsetHeight;
        dom.style.transition = 'all .3s';

        dom.style.transform = 'scaleY(0)';
        return true;
      },
      popupAnimate(self: any, pen: any, dom: HTMLElement) {
        dom.style.transform = 'scaleY(1)';
        return true;
      },
      popup: [
        {
          menu: {
            text: '矩形',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" t="1698915834790" class="icon" viewBox="0 0 1365 1024" version="1.1" p-id="13181" width="50" height="30"><path d="M920.32924106 188.22098215H435.74469865c-178.43219866 0-323.49023438 145.05719866-323.49023438 323.49023436 0 178.43219866 145.05803572 323.49023438 323.49023438 323.49023439h484.58454241c178.43303572 0 323.49023438-145.05803572 323.49023437-323.49023439 0.14481026-178.28822544-144.91322544-323.49023438-323.49023437-323.49023436z m2.65345982 603.01339285H439.05440848c-145.05719866 0-281.40652902-137.4375-281.40652903-281.19475447 0-145.05803572 132.71735492-270.29966518 277.77455357-270.29966518h489.52064732c145.05803572 0 272.32700893 131.98995536 272.32700893 275.74720983 0 143.61328125-129.22935267 275.74720982-274.28738839 275.74720982z" p-id="13182"/></svg>',
          },
          event: 'click',
          func(self: any, pen: any, dom: HTMLElement, father: any) {
            mindBoxPlugin.addNode(pen, 0, 'mindNode2', {width: 200, height: 50});
            father.close();
          }
        },
        {
          menu: {
            text: '菱形',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" t="1698916220010" class="icon" viewBox="0 0 1024 1024" version="1.1" p-id="13326" width="50" height="30"><path d="M485.213 869.904c6.744 4.822 18.199 8.603 26.787 8.603 8.588 0 21.779-2.476 28.32-7.442l467.957-336.878c13.427-9.665 13.47-26.284 0-35.915l-469.49-335.716c-6.726-4.81-19.733-10.927-28.321-10.927-8.588 0-23.313 7.122-29.855 12.088L15.723 498.272c-13.43 9.664-13.47 26.284 0 35.915z m23.719-671.51l452.01 322.481L512 835.227 63.058 518.553z" p-id="13327"/></svg>',
          },
          event: 'click',
          func(self: any, pen: any, dom: HTMLElement, father: any) {
            mindBoxPlugin.addNode(pen, 0, 'diamond', {width: 200, height: 120});
            father.close();
          }
        },
        {
          menu: {
            text: '椭圆',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="50px" height="30px" viewBox="0 0 140 53" version="1.1">\n' +
              '    <title>椭圆形备份 12</title>\n' +
              '    <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n' +
              '        <g id="未固定" transform="translate(-372.000000, -738.000000)" stroke="#000000" stroke-width="2">\n' +
              '            <ellipse id="椭圆形备份-12" cx="442" cy="764.5" rx="69" ry="25.5"/>\n' +
              '        </g>\n' +
              '    </g>\n' +
              '</svg>',
          },
          event: 'click',
          func(self: any, pen: Pen, dom: HTMLElement, father: any) {
            mindBoxPlugin.addNode(pen, 0, 'circle', {width: 200, height: 75});
            father.close();
          }
        }
      ],
    }, {
    key: 'extra',
  },
    {
      key: 'relayout',
      description: '用于重新布局某节点下的所有子节点',
      menu: {
        text: '重新布局',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="34px" height="34px" viewBox="0 0 34 34" version="1.1">\n' +
          '    <title>重新布局</title>\n' +
          '    <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n' +
          '        <g id="未固定" transform="translate(-577.000000, -138.000000)" stroke="#818187">\n' +
          '            <g id="编组-2" transform="translate(253.000000, 135.000000)">\n' +
          '                <g id="仅重布局子集" transform="translate(324.000000, 3.000000)">\n' +
          '                    <rect id="矩形备份-6" x="7.5" y="7.5" width="19" height="19" rx="1"/>\n' +
          '                    <line x1="7.5" y1="13.5" x2="26.5" y2="13.5" id="直线-11" stroke-linecap="square"/>\n' +
          '                    <line x1="14.325" y1="18.5" x2="26.325" y2="18.5" id="直线-11备份-4" stroke-linecap="square"/>\n' +
          '                    <line x1="14.325" y1="23.5" x2="26.325" y2="23.5" id="直线-11备份-5" stroke-linecap="square"/>\n' +
          '                    <line x1="13.5" y1="13.5" x2="13.5" y2="25.5" id="直线-11备份" stroke-linecap="square"/>\n' +
          '                    <line x1="17.5" y1="13.5" x2="17.5" y2="25.5" id="直线-11备份-2" stroke-linecap="square"/>\n' +
          '                    <line x1="22.5" y1="13.5" x2="22.5" y2="25.5" id="直线-11备份-3" stroke-linecap="square"/>\n' +
          '                </g>\n' +
          '            </g>\n' +
          '        </g>\n' +
          '    </g>\n' +
          '</svg>',
      },
      event: 'click',
      func(self: FuncOption, pen: any, dom: HTMLElement, e: MouseEvent) {
        let children = pen.mind?.children || [];
        if (children.length > 0) {
          mindBoxPlugin.update(pen, true);
        }
      },
      // setDom(self,dom){
      //   // draw your dom freeDom！！！
      //   let result =  `<span>${self.name}</span>`;
      //   return result;
      // }
      closeOther: true
    },
    {
      key: 'relayoutNext',
      description: '用于重新布局某节点下的第一级子节点',
      closeOther: true,
      menu: {
        text: '重新布局下一级',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="34px" height="34px" viewBox="0 0 34 34" version="1.1">\n' +
          '    <title>重新布局下一级</title>\n' +
          '    <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n' +
          '        <g id="未固定" transform="translate(-531.000000, -138.000000)" stroke="#818187">\n' +
          '            <g id="编组-2" transform="translate(253.000000, 135.000000)">\n' +
          '                <g id="重新布局" transform="translate(278.000000, 3.000000)">\n' +
          '                    <rect id="矩形备份-6" x="7.5" y="7.5" width="19" height="19" rx="1"/>\n' +
          '                    <line x1="7.5" y1="13.5" x2="26.5" y2="13.5" id="直线-11" stroke-linecap="square"/>\n' +
          '                    <line x1="13.5" y1="13.5" x2="13.5" y2="25.5" id="直线-11备份" stroke-linecap="square"/>\n' +
          '                </g>\n' +
          '            </g>\n' +
          '        </g>\n' +
          '    </g>\n' +
          '</svg>',
      },
      event: 'click',
      func(self: FuncOption, pen: any) {
        let children = pen.mind?.children || [];
        if (children.length > 0) {
          mindBoxPlugin.update(pen, false);
        }
      }
    }, {
    key: 'extra'
  },
    {
      key: 'nodeStyle',
      menu: {
        text: '边框样式',
        dom(self: FuncOption) {
          let color = self.color;
          let dash = self.dash;
          let width = self.width;
          let HTML = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="34px" height="34px" viewBox="0 0 34 34" version="1.1">
                    <title>边框样式</title>
                    <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                        <g id="未固定" transform="translate(-628.000000, -138.000000)">
                            <g id="编组-2" transform="translate(253.000000, 135.000000)">
                                <g id="边框颜色" transform="translate(375.000000, 3.000000)">
                                    <rect id="透明底图" fill-opacity="0" fill="#FFFFFF" x="0" y="0" width="34" height="34"/>
                                    <circle id="椭圆形" stroke="${color}" stroke-width="${width}" cx="17" cy="17" r="8" stroke-dasharray="${dash}"/>
                                </g>
                            </g>
                        </g>
                    </g>
                </svg>`;
          return HTML;
        },
      },
      color: '#4D4DFF',
      dash: '5,5',
      width: 4,
      colorList: ['#5757F3', '#FD42DD', '#8C8CFF', '#19f1cc',
        '#6ffd97', '#efe864', '#ff931a', '#fa7878'],
      popupEvent: 'mouseover',
      /**
       * @description 初始化函数
       * @param self 配置项本身
       * @param pen 木匾画笔
       */
      init(self: FuncOption, pen: any) {
        self.dash = pen.lineDash ? `${pen.lineDash[0]},${pen.lineDash[1]}` : '0,0';
        self.width = (+pen.lineWidth).toFixed(0);
        self.color = pen.mind.color || pen.calculative.color || '#000000';
      },

      stopPropagation: true,
      collapseAnimate(self: FuncOption, pen: any, dom: HTMLElement) {
        dom.style.transform = 'scaleY(0)';
        return true;
      },
      popupAnimate(self: FuncOption, pen: any, dom: HTMLElement) {
        dom.style.transform = 'scaleY(1)';
        return true;
      },
      popup(self: FuncOption, pen: any) {
        let dom = createDom('div', {
          style: {
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            transformOrigin: 'top',
            transition: 'all .3s',
            position: 'absolute',
            top: '40px',
            backgroundColor: '#fff',
            borderRadius: '5px',
            padding: '16px',
            width: '140px',
            boxShadow: '0px 6px 20px rgba(25,25,26,.06), 0px 2px 12px rgba(25,25,26,.04)'
          }
        });
        dom.attachShadow({mode: 'open'});
        let gap = createDom('div', {
          style: {
            width: '100%',
            height: '20px',
            backgroundColor: 'red',
            position: 'absolute',
            top: '-10px',
            opacity: 0
          }
        });
        dom.shadowRoot!.appendChild(gap);
        /**
         * @description 通过此函数你可以自由地自定义工具栏的样式 采用影子dom 使得style相互隔离
         * @param self 此配置项自身
         * @param dom 插件提供的包含容器 即你创建的dom的外部div对象
         * @return string dom字符串
         * */
        let str = Scope(self, {
          template: `
          <div class="container">
              <div class="item">
                <div class="title">边框粗细</div>
                <div class="main">
                  <input type="range" min="1" max="10" style="width: 81px" @change="sliderChange(this.value)" id="width" value="${self.width}">  <span id="t" style="display:block;vertical-align: top;margin-left: 10px;width: 41px;height: 20px;background-color:#f7f7f9;text-align: center;line-height: 20px">${self.width}</span>
                </div>
              </div>
                  <div class="item">
                <div class="title">边框样式</div>
                <div class="main_style ">
                  <div class="style_item ${self.dash === '0,0' ? 'style_active' : ''}" data-style="直线" @click="setOutLineStyle(true)">
                     <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="50px" height="2px" viewBox="0 0 78 2" version="1.1">
                        <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
                            <g id="未固定" transform="translate(-402.000000, -306.000000)" stroke="#000000" stroke-width="2">
                                <line x1="403" y1="307" x2="479" y2="307" id="直线-12备份-9"/>
                            </g>
                        </g>
                    </svg>
                  </div>
                  <div class="style_item  ${self.dash === '5,5' ? 'style_active' : ''}" data-style="虚线" @click="setOutLineStyle(false)">
                    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="50px" height="2px" viewBox="0 0 78 2" version="1.1">
                        <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-dasharray="4" stroke-linecap="round">
                            <g id="未固定" transform="translate(-402.000000, -306.000000)" stroke="#000000" stroke-width="2">
                                <line x1="403" y1="307" x2="479" y2="307" id="直线-12备份-9"/>
                            </g>
                        </g>
                    </svg>
                  </div>
                </div>
              </div>
              <div class="item">
                <div class="title">边框颜色
                <label for="color">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="18px" height="17px" viewBox="0 0 18 17" version="1.1">
    <title>吸管</title>
    <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g id="未固定" transform="translate(-279.000000, -349.000000)" stroke="#818187">
            <g id="编组-6备份-2" transform="translate(208.000000, 188.000000)">
                <g id="吸管" transform="translate(72.062370, 161.000000)">
                    <g id="编组-8" transform="translate(7.937630, 8.095196) rotate(-315.000000) translate(-7.937630, -8.095196) translate(4.036351, 0.770971)">
                        <path d="M4.96179031,5.89679753 L4.96179031,10.0040546 C4.96179031,10.4930202 4.63081262,10.9045357 4.18105852,11.0275164 L4.18153455,13.8681947 L3.62149907,11.0275164 C3.17174496,10.9045357 2.84076728,10.4930202 2.84076728,10.0040546 L2.84076728,5.89679753 L4.96179031,5.89679753 Z" id="形状结合"/>
                        <path d="M3.90127879,0.5 C4.40959264,0.5 4.86978446,0.706034895 5.20289782,1.03914825 C5.53601117,1.37226161 5.74204607,1.83245343 5.74204607,2.34076728 L5.74204607,5.66776861 L2.06051152,5.66776861 L2.06051152,2.34076728 C2.06051152,1.83245343 2.26654641,1.37226161 2.59965977,1.03914825 C2.93277313,0.706034895 3.39296495,0.5 3.90127879,0.5 Z" id="形状结合"/>
                        <line x1="0.390127879" y1="5.78228307" x2="7.41242971" y2="5.78228307" id="直线-13" stroke-linecap="round"/>
                    </g>
                </g>
            </g>
        </g>
    </g>
</svg>
                  </div>
                  <input id="color" style="display: none" type="color"  @change="setColor(event,this.value)" value="${self.color}">
                </label>
                     <div class="main">

                     <div class="colorList" onclick="setColor(event)">
                     ${self.colorList.map((i: string, index: number) => `<span class="color_item ${self.color === i ? 'active' : ''}" style="background-color: ${i};border: 3px solid ${i}" data-color="${i}"></span>`).join('')}
                     </div>
                </div>
              </div>
          </div>`,
          script: {
            // 能在这里面获取到dom
            init() { // 生命周期函数
              self.dash = pen.lineDash?.join(',') || '0,0';
              if (self.dash === '0,0') {
                this.lineactive = 'style_active';
                this.dashActive = '';
              } else {
                this.lineactive = '';
                this.dashActive = 'style_active';
              }
            },
            value: 10,
            lineactive: 'style_active',
            dashActive: '',
            setOutLineStyle(style: string) {
              let res = style ? [0, 0] : [5, 5];
              meta2d.setValue({
                id: pen.id,
                lineDash: res
              }, {render: true});
              self.dash = res.join(',');
              self.updateAll();
              // self.close()
            },
            sliderChange: (value: number) => {
              self.width = value;
              // toolbox.renderFuncList()
              meta2d.setValue({
                id: pen.id,
                lineWidth: value
              }, {render: true});
              self.update('menu');
              self.update('popup', true);

            },
            setColor(e: MouseEvent, value: string) {
              let color = '';
              if (!value) {
                let t = e.target;
                let list = dom.shadowRoot!.querySelector('.colorList');
                if (t === list) return;
                // @ts-ignore
                color = t.dataset.color;
              } else {
                color = value;
              }
              if (color === self.color) {
                color = '';
              } else {
                meta2d.setValue({
                  id: pen.id,
                  color
                }, {render: false});
              }
              pen.mind.color = color;
              mindBoxPlugin.calcChildrenColor(meta2d.store.pens[pen.mind.preNodeId] || pen);
              mindBoxPlugin.resetLinesColor(pen);
              mindBoxPlugin.render();
              self.color = color || pen.calculative.color;
              self.updateAll();
            }
          },
          style: `<style>
        .container {
            overflow: hidden;
        }
        .main {
            display: flex;
            flex-direction: row;
            justify-content: space-around;
            align-items: center;
        }
        .style_active{
            width: 30%;
            background-color:#fff;
            height: 20px;
            box-shadow: 0 0 5px 1px rgba(0, 0, 0, 0.2);
            border-radius: 3px;
        }
        .active{
            border: 3px solid deepskyblue !important;
        }
        .colorList {
            display: flex;
            justify-content: space-between;
            align-content: space-between;
            flex-wrap: wrap;
        }
        .main_style {
            display: flex;
            width: 100%;
            height: 30px;
            justify-content: space-around;
            align-items: center;
            border-radius: 3px;
            background-color:#f7f7f9;
        }
        .style_item {
            width:47%;
            height: 22px;
            display: flex;
            align-items: center;
            overflow: hidden;
            justify-content: center;
        }
        .color_item {
            width: 20px;
            height: 20px;
            border: 3px solid;
            margin: 5px 5px 5px 0;
            border-radius: 2px;
        }
        .color_item:hover {
            border: 3px solid rgba(128,128,128,0.5) !important;
        }
       .item {
          display:flex;
          justify-content: flex-start;
          align-items: flex-start;
          flex-direction: column;
          margin-bottom: 14px;
       }
       .title {
          width: 100%;
          height: 17px;
          font-size: 16px;
          display: flex;
          justify-content: flex-start;
          align-items: center;
          font-family: PingFang SC, PingFang SC-Regular;
          font-weight: 400;
          text-align: left;
          color: #7d7878;
          line-height: 17px;
          margin-bottom: 14px;
        }
    </style>
        `
        }, 'dom');
        dom.shadowRoot!.appendChild(str);
        return dom;
      }

      // children: [
      //   {
      //     name:'直线',
      //     event: 'click',
      //     func(self, pen, dom, father) {
      //       meta2d.setValue({id:pen.id,lineDash:[0,0]})
      //       father.dash = '0,0';
      //       toolbox.renderFuncList()
      //     }
      //   },
      //   {
      //     name:'虚线',
      //     event: 'click',
      //     func(self, pen, dom, father) {
      //       meta2d.setValue({id:pen.id,lineDash:[5,5]})
      //       father.dash = '5,5';
      //       toolbox.renderFuncList()
      //     }
      //   }
      // ]
    },
    {
      key: 'lineStyle',
      description: '用于重新设置线条样式',
      menu: {
        text: '线条样式',
        dom(self: FuncOption, pen: any) {
          let html = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="34px" height="34px" viewBox="0 0 34 34" version="1.1">
        <title>连线样式</title>
        <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
          <g id="未固定" transform="translate(-674.000000, -138.000000)">
            <g id="编组-2" transform="translate(253.000000, 135.000000)">
              <g id="连线颜色" transform="translate(421.000000, 3.000000)">
                <rect id="透明底图" fill-opacity="0" fill="#FFFFFF" x="0" y="0" width="34" height="34"/>
                <line x1="7.5" y1="17.5" x2="27.5" y2="17.5" id="直线-9" stroke="${self.color || pen.color}" stroke-dasharray="${self.dash}" stroke-width="${self.width}" stroke-linecap="round"/>
              </g>
            </g>
          </g>
        </g>
      </svg>`;
          return html;
        },
      },
      color: '#4D4DFF',
      lineStyle: 'mind',
      width: 3,
      init(self: FuncOption, pen: any) {
        self.color = pen.mind.lineColor || pen.calculative.color || '#000000';
        self.lineStyle = pen.mind.lineStyle || (meta2d.findOne(pen.mind.rootId) as any).mind.lineStyle;
        self.width = (meta2d.findOne(pen.mind.rootId) as any).mind.lineWidth;
      },

      /**
       * @description 设置下拉框的样式，你也可以使用webComponent，或者将vue组件转换为webComponent
       * @param self 本配置对象
       * @param pen 返回当前pen对象
       * @param dom 返回此容器dom
       * */
      colorList: ['#f13097', '#5757F3', '#fa7878', '#8C8CFF', '#19f1cc',
        '#6ffd97', '#efe864', '#ff931a'],
      shadowRoot: false,
      collapseEventOnMenu: false,
      openEventOnTitle: true,
      popupEvent: 'mouseenter',
      collapseEvent: 'click',
      collapseAnimate(self: FuncOption, pen: any, dom: HTMLElement) {
        dom.style.transform = 'scaleY(0)';
        return true;
      },
      popupAnimate(self: FuncOption, pen: any, dom: HTMLElement) {
        dom.style.transform = 'scaleY(1)';
        return true;
      },
      popup(self: FuncOption, pen: any) {
        let dom: any = createDom('div', {
          style: {
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            transformOrigin: 'top',
            boxSizing: 'content-box',
            transition: 'all .3s',
            justifyContent: 'flex-start',
            position: 'absolute',
            top: '40px',
            backgroundColor: '#fff',
            borderRadius: '5px',
            padding: '16px',
            width: '140px',
            boxShadow: '0px 6px 20px rgba(25,25,26,.06), 0px 2px 12px rgba(25,25,26,.04)',
          }
        });
        dom.attachShadow({mode: 'open'});
        let str = Scope(self, {
          template: `
          <div class="container">
                <div class="item">
                <div class="title">线条粗细</div>
                <div class="main">
                  <input type="range" min="1" max="10" style="width: 81px" onchange="sliderChange(this.value)" id="width" value="${self.width}">  <span id="t" style="display:block;vertical-align: top;margin-left: 10px;width: 41px;height: 20px;background-color:#f7f7f9;text-align: center;line-height: 20px">${self.width}</span>
                </div>
              </div>
            <div class="item">
                <div class="title">连线样式</div>
                <div class="main_style ">
                  <div class="style_item ${self.lineStyle === 'mind' ? 'style_active' : ''}" data-style="曲线" onclick="setLineStyle(true)">
                    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="50px" height="20px">
                  <g fill="none" stroke="black" stroke-width="1">
                    <path d="M0 9 a100,50 0 0,1 85,0"></path>
                  </g>
                </svg>
                  </div>
                  <div class="style_item ${self.lineStyle === 'polyline' ? 'style_active' : ''}" data-style="折线" onclick="setLineStyle(false)">
                     <svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="50px" height="20px">
                    <g fill="none" stroke="black" stroke-width="1">
                      <path d="M0 4 l25 0 l0 12 l40 0"></path>
                    </g>
                  </svg>
                  </div>
                </div>
              </div>
              <div class="item">
                <div class="title">连线颜色
                <label for="color">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="18px" height="17px" viewBox="0 0 18 17" version="1.1">
    <title>吸管</title>
    <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g id="未固定" transform="translate(-279.000000, -349.000000)" stroke="#818187">
            <g id="编组-6备份-2" transform="translate(208.000000, 188.000000)">
                <g id="吸管" transform="translate(72.062370, 161.000000)">
                    <g id="编组-8" transform="translate(7.937630, 8.095196) rotate(-315.000000) translate(-7.937630, -8.095196) translate(4.036351, 0.770971)">
                        <path d="M4.96179031,5.89679753 L4.96179031,10.0040546 C4.96179031,10.4930202 4.63081262,10.9045357 4.18105852,11.0275164 L4.18153455,13.8681947 L3.62149907,11.0275164 C3.17174496,10.9045357 2.84076728,10.4930202 2.84076728,10.0040546 L2.84076728,5.89679753 L4.96179031,5.89679753 Z" id="形状结合"/>
                        <path d="M3.90127879,0.5 C4.40959264,0.5 4.86978446,0.706034895 5.20289782,1.03914825 C5.53601117,1.37226161 5.74204607,1.83245343 5.74204607,2.34076728 L5.74204607,5.66776861 L2.06051152,5.66776861 L2.06051152,2.34076728 C2.06051152,1.83245343 2.26654641,1.37226161 2.59965977,1.03914825 C2.93277313,0.706034895 3.39296495,0.5 3.90127879,0.5 Z" id="形状结合"/>
                        <line x1="0.390127879" y1="5.78228307" x2="7.41242971" y2="5.78228307" id="直线-13" stroke-linecap="round"/>
                    </g>
                </g>
            </g>
        </g>
    </g>
</svg>
                  </div>
                  <input id="color" style="display: none" type="color" onchange="setColor(event,this.value)" value="${self.color}">
                </label>
                     <div class="main">

                     <div class="colorList" onclick="setColor(event)">
                     ${self.colorList.map((i: string, index: number) => `<span class="color_item ${self.color === i ? 'active' : ''}" style="background-color: ${i};border: 3px solid ${i}" data-color="${i}"></span>`).join('')}
                     </div>
                </div>
              </div>
          </div>`,
          script: {
            sliderChange: (value: number) => {
              dom.shadowRoot.querySelector('#t').innerHTML = value;
              self.width = value;
              // toolbox.renderFuncList()
              // pen.connectedLines?.forEach(i=>{
              //   meta2d.setValue({
              //     id:i.lineId,
              //     lineWidth: value
              //   })
              // })
              let root: any = meta2d.findOne(pen.mind.rootId);
              root.mind.lineWidth = value;
              mindBoxPlugin.resetLinesStyle(root);
              self.update('menu');
            },
            setLineStyle(value: string) {
              let res = value ? 'mind' : 'polyline';
              // toolbox.renderFuncList()

              let root:any = meta2d.findOne(pen.mind.rootId);
              root.mind.lineStyle = res;
              mindBoxPlugin.resetLinesStyle(root);
              self.lineStyle = res;
              // mindBoxPlugin.update(root);
              self.updateAll();
            },
            setColor(e: any, value: string) {
              let color = '';
              if (!value) {
                let t = e.target;
                let list = dom.shadowRoot.querySelector('.colorList');
                if (t === list) return;
                color = t.dataset.color;
              } else {
                color = value;
              }
              if (color === self.color) {
                color = '';
              }

              pen.connectedLines?.forEach((i: any) => {
                meta2d.setValue({
                  id: pen.id,
                  'mind.lineColor': color
                }, {render: true});
              });
              self.color = color;
              mindBoxPlugin.resetLinesColor(pen, true);
              self.updateAll();
            }
          },
          style: `<style>
        .container {
            overflow: hidden;
        }
        .main {
            display: flex;
            flex-direction: row;
            justify-content: space-around;
            align-items: center;
        }
        .style_active{
            width: 30%;
            background-color:#fff;
            height: 20px;
            box-shadow: 0 0 5px 1px rgba(0, 0, 0, 0.2);
            border-radius: 3px;
        }
        .active{
            border: 3px solid deepskyblue !important;
        }
        .colorList {
            display: flex;
            justify-content: space-between;
            align-content: space-between;
            flex-wrap: wrap;
        }
        .main_style {
            display: flex;
            width: 100%;
            height: 30px;
            justify-content: space-around;
            align-items: center;
            border-radius: 3px;
            background-color:#f7f7f9;
        }
        .style_item {
            width:47%;
            height: 22px;
            display: flex;
            align-items: center;
            overflow: hidden;
            justify-content: center;
        }
        .color_item {
            width: 20px;
            height: 20px;
            border: 3px solid;
            margin: 5px 5px 5px 0;
            border-radius: 2px;
        }
        .color_item:hover {
            border: 3px solid rgba(128,128,128,0.5) !important;
        }
       .item {
          display:flex;
          justify-content: flex-start;
          align-items: flex-start;
          flex-direction: column;
          margin-bottom: 14px;
       }
       .title {
          width: 100%;
          height: 17px;
          font-size: 16px;
          display: flex;
          justify-content: flex-start;
          align-items: center;
          font-family: PingFang SC, PingFang SC-Regular;
          font-weight: 400;
          text-align: left;
          color: #7d7878;
          line-height: 17px;
          margin-bottom: 14px;
        }
    </style>
        `
        }, 'string');
        let gap = createDom('div', {
          style: {
            width: '100%',
            height: '20px',
            backgroundColor: 'red',
            position: 'absolute',
            top: '-10px',
            opacity: 0
          }
        });
        dom.shadowRoot.innerHTML = str;
        dom.shadowRoot.appendChild(gap);
        return dom;
      },
      event: 'mouseenter',
      func(self: FuncOption, pen: any, dom: HTMLElement) {
        self.open = true;
      }
    }, {
    key: 'extra'
  },
    {
      key: 'layoutDirection',
      description: '用于重新设置脑图基本设置',
      menu: {
        text: '基本设置',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" t="1698740367149" class="icon" viewBox="0 0 1024 1024" version="1.1" p-id="13181" width="34" height="20"><path d="M914.752 292.608c26.112 0 47.232 21.12 47.232 47.296v577.088c0 26.112-21.12 47.232-47.232 47.232H110.4a47.232 47.232 0 0 1-47.296-47.232V339.904c0-26.112 21.12-47.296 47.296-47.296h804.352z m-6.72 54.016H117.12v563.648h790.848V346.624z" p-id="13182"/><path d="M957.44 484.992v64H62.08v-64z" p-id="13183"/><path d="M957.44 484.992v64H62.08v-64zM409.536 735.36l63.104-0.128 0.896 198.528-63.104 0.192zM561.472 600.32l63.168-0.064 0.832 333.568-63.232 0.128zM578.368 62.016c8.704 0 15.744 7.04 15.744 15.744v268.864H430.976V77.76c0-8.704 7.04-15.744 15.744-15.744h131.648z m-38.272 54.016h-55.04v176.64h55.04v-176.64z" p-id="13184"/></svg>',
      },
      direction: 'right',
      childrenGap: 20,
      levelGap: 0,
      init(self: FuncOption, pen: any) {
        self.direction = pen.mind.direction;
        self.childrenGap = mindBoxPlugin.childrenGap;
        self.levelGap = mindBoxPlugin.levelGap;
        self.animate = mindBoxPlugin.animate;
        pen.locked = 0;
        self.status = self.animate ? '已开启' : '已关闭';
      },
      activeDirection(self: FuncOption, pen: any, dom: HTMLElement) {
        let rootDom = dom.querySelector('.main');
        let divs = rootDom!.querySelectorAll('div');
        let index = ['right', 'left', 'top', 'bottom', 'butterfly', 'sandglass'].findIndex(i => i === self.direction);
        divs.forEach(i => {
          i.querySelectorAll('.toolbox_direction_svg').forEach(i => {
            i.setAttribute('fill', '#DDDDE1');
          });
          i.querySelectorAll('.toolbox_direction_svg_base').forEach(i => {
            i.setAttribute('fill', '#F8F8FC');
          });
          i.querySelectorAll('.toolbox_direction_svg_line').forEach(i => {
            i.setAttribute('stroke', '#818187');
          });
        });

        // @ts-ignore
        divs[index].querySelector('.toolbox_direction_svg_base').setAttribute('fill', '#CDCDFC');
        // @ts-ignore
        divs[index].querySelector('.toolbox_direction_svg_line').setAttribute('stroke', '#7878FF');
        divs[index].querySelectorAll('.toolbox_direction_svg').forEach(i => i.setAttribute('fill', '#7878FF'));
      },
      popupEvent: 'mouseenter',
      collapseEventOnMenu: false, // 是否在childrenDom中触发事件
      collapseEvent: 'none',
      stopPropagation: true,
      animate: false,
      collapseAnimate(self: FuncOption, pen: any, dom: HTMLElement) {
        dom.style.transform = 'scaleY(0)';
        return true;
      },
      mounted(self: FuncOption, pen: Pen, dom: HTMLElement) {
        self.activeDirection(self, pen, dom);
      },
      popupAnimate(self: FuncOption, pen: Pen, dom: HTMLElement) {
        dom.style.transform = 'scaleY(1)';
        return true;
      },
      onPopup(self: FuncOption, pen: Pen, dom: HTMLElement) {
        self.activeDirection(self, pen, dom);
        self.childrenGap = mindBoxPlugin.childrenGap;
        self.levelGap = mindBoxPlugin.levelGap;
        pen.locked = 1;
      },
      onCollapse(self: FuncOption, pen: Pen) {
        pen.locked = 0;
      },
      status: '已开启',
      // 设置下拉列表的样式和子元素布局
      popup(self: FuncOption, pen: any) {
        let dom = createDom('div', {
          style: {
            display: 'flex',
            flexDirection: 'row',
            transformOrigin: 'top',
            transition: 'all .3s',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            position: 'absolute',
            top: '40px',
            backgroundColor: '#fff',
            borderRadius: '5px',
            padding: '16px',
            zIndex: 999,
            width: '170px',
            boxShadow: '0px 6px 20px rgba(25,25,26,.06), 0px 2px 12px rgba(25,25,26,.04)',
          }, event: '', func: undefined, className: 'root'
        });

        let str = Scope(self, {
          template: `
          <div class="container">
              <div class="item">
                <div class="title">布局方向</div>
                <div class="main" >
                    <div onclick="setDirection('right')" >
                        <svg class="main_item" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="76px" height="50px" viewBox="0 0 76 50" version="1.1">
                          <title>向右布局</title>
                         <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                              <g id="未固定" transform="translate(-633.000000, -684.000000)">
                                <g id="编组-6备份" transform="translate(525.000000, 423.000000)">
                                     <g id="布局备份-9" transform="translate(108.000000, 261.000000)">
                                          <rect class="toolbox_direction_svg_base" id="偷摸底图" fill="#F8F8FC" x="0" y="0" width="76" height="50" rx="2"/>
                                          <g id="编组-3" transform="translate(20.000000, 7.000000)">
                                              <line class="toolbox_direction_svg" x1="13.5" y1="18.5" x2="22.969697" y2="18.5" id="直线-12备份-2" stroke="#818187" stroke-linecap="round"/>
                                              <rect class="toolbox_direction_svg_line" id="矩形" stroke="#818187" x="0.5" y="15.5" width="13" height="5" rx="2"/>
                                              <path class="toolbox_direction_svg_line" d="M28,35 C22.4771525,35 18,27.836556 18,19 C18,10.163444 22.4771525,3 28,3" id="路径" stroke="#818187" stroke-linecap="round"/>
                                              <rect class="toolbox_direction_svg" id="矩形备份-11" fill="#DDDDE1" x="25" y="0" width="10" height="5" rx="2"/>
                                              <rect class="toolbox_direction_svg" id="矩形备份-12" fill="#DDDDE1" x="25" y="16" width="10" height="5" rx="2"/>
                                              <rect class="toolbox_direction_svg" id="矩形备份-13" fill="#DDDDE1" x="25" y="32" width="10" height="5" rx="2"/>
                                          </g>
                                      </g>
                                 </g>
                              </g>
                          </g>
                        </svg>
                    </div>

                    <div onclick="setDirection('left')"  >
                      <svg class="main_item" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="76px" height="50px" viewBox="0 0 76 50" version="1.1">
                          <title>向左布局</title>
                          <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                              <g id="未固定" transform="translate(-541.000000, -684.000000)">
                                  <g id="编组-6备份" transform="translate(525.000000, 423.000000)">
                                      <g id="布局备份-8" transform="translate(16.000000, 261.000000)">
                                          <rect class="toolbox_direction_svg_base" id="透明底图" fill="#F8F8FC" x="0" y="0" width="76" height="50" rx="2"/>
                                          <g id="编组-3" transform="translate(37.500000, 25.500000) scale(-1, 1) translate(-37.500000, -25.500000) translate(20.000000, 7.000000)">
                                             <line class="toolbox_direction_svg" x1="13.5" y1="18.5" x2="22.969697" y2="18.5" id="直线-12备份-2" stroke="#818187" stroke-linecap="round"/>
                                              <rect class="toolbox_direction_svg_line" id="矩形" stroke="#818187" x="0.5" y="15.5" width="13" height="5" rx="2"/>
                                              <path class="toolbox_direction_svg_line" d="M28,35 C22.4771525,35 18,27.836556 18,19 C18,10.163444 22.4771525,3 28,3" id="路径" stroke="#818187" stroke-linecap="round"/>
                                              <rect class="toolbox_direction_svg" id="矩形备份-11" fill="#DDDDE1" x="25" y="0" width="10" height="5" rx="2"/>
                                              <rect class="toolbox_direction_svg" id="矩形备份-12" fill="#DDDDE1" x="25" y="16" width="10" height="5" rx="2"/>
                                              <rect class="toolbox_direction_svg" id="矩形备份-13" fill="#DDDDE1" x="25" y="32" width="10" height="5" rx="2"/>
                                          </g>
                                      </g>
                                  </g>+
                              </g>
                          </g>
                      </svg>
                    </div>

                    <div onclick="setDirection('top')" >
                      <svg class="main_item" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="76px" height="50px" viewBox="0 0 76 50" version="1.1">
                        <title>向上布局</title>
                        <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                            <g id="未固定" transform="translate(-633.000000, -616.000000)">
                                <g id="编组-6备份" transform="translate(525.000000, 423.000000)">
                                    <g id="布局备份-7" transform="translate(108.000000, 193.000000)">
                                        <rect class="toolbox_direction_svg_base" id="透明底图" fill="#F8F8FC" x="0" y="0" width="76" height="50" rx="2"/>
                                        <g id="编组-3" transform="translate(38.000000, 25.250000) scale(1, -1) rotate(-270.000000) translate(-38.000000, -25.250000) translate(25.750000, 0.750000)">
                                            <line class="toolbox_direction_svg" x1="6.06363636" y1="25.5" x2="15.5333333" y2="25.5" id="直线-12备份-2" stroke="#818187" stroke-linecap="round"/>
                                            <rect class="toolbox_direction_svg_line" id="矩形" stroke="#818187" transform="translate(3.000000, 25.500000) rotate(-90.000000) translate(-3.000000, -25.500000) " x="-3.5" y="23" width="13" height="5" rx="2"/>
                                            <path class="toolbox_direction_svg_line" d="M17.8386311,43 C15.0303966,40.513797 13,33.3135934 13,24.8187892 C13,16.7047472 14.8524591,9.77185117 17.465812,7" id="路径" stroke="#818187" stroke-linecap="round"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-11" fill="#DDDDE1" transform="translate(22.000000, 44.000000) rotate(-90.000000) translate(-22.000000, -44.000000) " x="17" y="41.5" width="10" height="5" rx="2"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-12" fill="#DDDDE1" transform="translate(22.000000, 25.000000) rotate(-90.000000) translate(-22.000000, -25.000000) " x="17" y="22.5" width="10" height="5" rx="2"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-13" fill="#DDDDE1" transform="translate(22.000000, 5.000000) rotate(-90.000000) translate(-22.000000, -5.000000) " x="17" y="2.5" width="10" height="5" rx="2"/>
                                        </g>
                                    </g>
                                </g>
                            </g>
                        </g>
                      </svg>
                    </div>

                    <div onclick="setDirection('bottom')">
                      <svg class="main_item" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="76px" height="50px" viewBox="0 0 76 50" version="1.1">
                        <title>向下布局</title>
                        <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                           <g id="未固定" transform="translate(-725.000000, -480.000000)">
                                <g id="编组-6备份" transform="translate(525.000000, 423.000000)">
                                    <g id="布局备份-2" transform="translate(200.000000, 57.000000)">
                                        <rect class="toolbox_direction_svg_base" id="透明底图" fill="#F8F8FC" x="0" y="0" width="76" height="50" rx="2"/>
                                        <g id="编组-3" transform="translate(38.000000, 25.250000) rotate(-270.000000) translate(-38.000000, -25.250000) translate(25.750000, 0.750000)">
                                            <line x1="6.06363636" y1="25.5" x2="15.5333333" y2="25.5" id="直线-12备份-2" stroke="#818187" stroke-linecap="round"/>
                                            <rect class="toolbox_direction_svg_line" id="矩形" stroke="#818187" transform="translate(3.000000, 25.500000) rotate(-90.000000) translate(-3.000000, -25.500000) " x="-3.5" y="23" width="13" height="5" rx="2"/>
                                            <path class="toolbox_direction_svg_line" d="M17.8386311,43 C15.0303966,40.513797 13,33.3135934 13,24.8187892 C13,16.7047472 14.8524591,9.77185117 17.465812,7" id="路径" stroke="#818187" stroke-linecap="round"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-11" fill="#DDDDE1" transform="translate(22.000000, 44.000000) rotate(-90.000000) translate(-22.000000, -44.000000) " x="17" y="41.5" width="10" height="5" rx="2"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-12" fill="#DDDDE1" transform="translate(22.000000, 25.000000) rotate(-90.000000) translate(-22.000000, -25.000000) " x="17" y="22.5" width="10" height="5" rx="2"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-13" fill="#DDDDE1" transform="translate(22.000000, 5.000000) rotate(-90.000000) translate(-22.000000, -5.000000) " x="17" y="2.5" width="10" height="5" rx="2"/>
                                        </g>
                                   </g>
                                </g>
                            </g>
                        </g>
                      </svg>
                    </div>

                    <div onclick="setDirection('butterfly')">
                    <svg class="main_item" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="76px" height="50px" viewBox="0 0 76 50" version="1.1">
                      <title>蝶形布局</title>
                      <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                          <g id="未固定" transform="translate(-541.000000, -480.000000)">
                              <g id="编组-6备份" transform="translate(525.000000, 423.000000)">
                                  <g id="布局" transform="translate(16.000000, 57.000000)">
                                      <rect class="toolbox_direction_svg_base" id="透明底图" fill="#F8F8FC" x="0.5" y="0.5" width="76" height="50" rx="2"/>
                                      <g id="编组-3" transform="translate(10.000000, 7.000000)">
                                          <line x1="12.5" y1="18.5" x2="21.969697" y2="18.5" id="直线-12备份" stroke="#818187" stroke-linecap="round"/>
                                          <line x1="35.5" y1="18.5" x2="44.969697" y2="18.5" id="直线-12备份-2" stroke="#818187" stroke-linecap="round"/>
                                          <rect class="toolbox_direction_svg_line" id="矩形" stroke="#818187" x="22.5" y="15.5" width="13" height="5" rx="2"/>
                                          <rect class="toolbox_direction_svg" id="矩形备份-8" fill="#DDDDE1" x="0" y="0" width="10" height="5" rx="2"/>
                                          <rect class="toolbox_direction_svg" id="矩形备份-11" fill="#DDDDE1" x="47" y="0" width="10" height="5" rx="2"/>
                                          <rect class="toolbox_direction_svg" id="矩形备份-9" fill="#DDDDE1" x="0" y="16" width="10" height="5" rx="2"/>
                                          <rect class="toolbox_direction_svg" id="矩形备份-12" fill="#DDDDE1" x="47" y="16" width="10" height="5" rx="2"/>
                                          <rect class="toolbox_direction_svg" id="矩形备份-10" fill="#DDDDE1" x="0" y="32" width="10" height="5" rx="2"/>
                                          <rect class="toolbox_direction_svg" id="矩形备份-13" fill="#DDDDE1" x="47" y="32" width="10" height="5" rx="2"/>
                                          <path class="toolbox_direction_svg_line" d="M11,3 C18.5461417,3 24.8721456,8.22403061 26.5588129,15.2528929 M26.9076362,20.7292725 C26.0454005,28.7525241 19.2522884,35 11,35" id="形状" stroke="#818187" stroke-linecap="round"/>
                                          <path class="toolbox_direction_svg_line" d="M30,3 C37.6543889,3 44.0533839,8.37497993 45.6285232,15.5564778 M45.9076362,20.7292725 C45.0454005,28.7525241 38.2522884,35 30,35" id="形状" stroke="#818187" transform="translate(37.953818, 19.000000) scale(-1, 1) translate(-37.953818, -19.000000) "/>
                                      </g>
                                  </g>
                              </g>
                          </g>
                      </g>
                    </svg>
                    </div>

                    <div onclick="setDirection('sandglass')">
                    <svg class="main_item" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="76px" height="50px" viewBox="0 0 76 50" version="1.1">
                    <title>沙漏布局</title>
                    <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                        <g id="未固定" transform="translate(-725.000000, -616.000000)">
                            <g id="编组-6备份" transform="translate(525.000000, 423.000000)">
                                <g id="编组-10" transform="translate(200.000000, 193.000000)">
                                    <rect class="toolbox_direction_svg_base" id="透明底图" fill="#F8F8FC" x="0" y="0" width="76" height="50" rx="2"/>
                                    <g id="编组-3" transform="translate(17.000000, 6.000000)">
                                        <g id="编组-9" transform="translate(0.000000, 0.000000)">
                                            <line x1="21.5" y1="7.5" x2="21.5" y2="16.5" id="直线-12备份" stroke="#818187" stroke-linecap="round"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-8" fill="#DDDDE1" x="0" y="0" width="10" height="5" rx="2"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-9" fill="#DDDDE1" x="16" y="0" width="10" height="5" rx="2"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-10" fill="#DDDDE1" x="32" y="0" width="10" height="5" rx="2"/>
                                            <path d="M15.5,-3.5 C20.402536,-3.5 24.6208608,0.196011148 26.5,5.5 M26.5,19.5 C24.5749169,24.8145404 20.3733294,28.5 15.5,28.5" id="形状" stroke="#818187" stroke-linecap="round" transform="translate(21.000000, 12.500000) rotate(-270.000000) translate(-21.000000, -12.500000) "/>
                                        </g>
                                        <g id="编组-9" transform="translate(21.000000, 29.000000) scale(1, -1) translate(-21.000000, -29.000000) translate(0.000000, 20.000000)">
                                            <line x1="21.5" y1="7.5" x2="21.5" y2="16.5" id="直线-12备份" stroke="#818187" stroke-linecap="round"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-8" fill="#DDDDE1" x="0" y="0" width="10" height="5" rx="2"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-9" fill="#DDDDE1" x="16" y="0" width="10" height="5" rx="2"/>
                                            <rect class="toolbox_direction_svg" id="矩形备份-10" fill="#DDDDE1" x="32" y="0" width="10" height="5" rx="2"/>
                                            <path d="M15.5,-3.5 C20.402536,-3.5 24.6208608,0.196011148 26.5,5.5 M26.5,19.5 C24.5749169,24.8145404 20.3733294,28.5 15.5,28.5" id="形状" stroke="#818187" stroke-linecap="round" transform="translate(21.000000, 12.500000) rotate(-270.000000) translate(-21.000000, -12.500000) "/>
                                        </g>
                                        <rect class="toolbox_direction_svg_line" id="矩形" stroke="#818187" x="14.5" y="16.5" width="13" height="5" rx="2"/>
                                    </g>
                                </g>
                            </g>
                        </g>
                    </g>
                </svg>
                    </div>
                </div>
              </div>

              <div class="item">
                <div class="title">间隔设置</div>
                <div class="main">
                    <div class="number_container">
                     <div class="number_item" onclick="(e=>{e.stopPropagation()})(event)">
                        <div class="flag">同级间隔</div>
                        <div class="number">
                            <input type="number" onchange="setChildGap(this.value)" value="${self.childrenGap}"/>
                        </div>
                    </div>
                     <div class="number_item" onclick="(e=>{e.stopPropagation()})(event)">
                        <div class="flag">子级间隔</div>
                        <div class="number">
                            <input type="number" onchange="setLevelGap(this.value)" value="${self.levelGap}"/>
                        </div>
                    </div>
                     <div class="number_item" onclick="(e=>{e.stopPropagation()})(event)">
                        <div class="flag">是否开启动画</div>
                        <div class="button">
                            <input type="button" onclick="setAnimate()" value="${self.status}"/>
                        </div>
                    </div>
                  </div>

                </div>
              </div>
          </div>`,
          script: {
            // 能在这里面获取到dom
            status: '已开启',
            setAnimate() {
              mindBoxPlugin.animate = !mindBoxPlugin.animate;
              pen.mind.mindboxOption.animate = mindBoxPlugin.animate;
              self.animate = mindBoxPlugin.animate;
              self.animate ? self.status = '已开启' :
                self.status = '已关闭';
              self.updateAll();
            },
            setChildGap(value: number) {
              self.childrenGap = value;
              mindBoxPlugin.childrenGap = value;
              pen.mind.mindboxOption.childrenGap = value;
              mindBoxPlugin.update(meta2d.findOne(pen.mind.rootId));
            },
            setLevelGap(value: number) {
              self.levelGap = value;
              mindBoxPlugin.levelGap = value;
              pen.mind.mindboxOption.levelGap = value;
              mindBoxPlugin.update(meta2d.findOne(pen.mind.rootId));
            },
            setDirection(e: string) {
              mindBoxPlugin.record(pen);

              let root = meta2d.findOne(pen.mind.rootId);
              mindBoxPlugin.resetLayOut(root, e, true);
              mindBoxPlugin.update(root);
              self.direction = e;
              self.activeDirection(self, pen, dom);
              self.close();
            }
          },
          style: `<style>
        .container {
            overflow: hidden;
        }
        .flag{
            font-size: 14px;
        }
        .number{
            height:30px;
            display: flex;
            border: 1px solid #f7f7f9;
            border-radius: 5px;
            justify-content: space-around;
            align-items: center;
            background-color: #f7f7f9;
        }
        .button {

        }
        .number_container{
            display: flex;
            width: 100%;
            justify-content: space-between;
            align-items: center;
            flex-direction: column;
        }
        .number_item{
            width: 100%;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            margin-top: 14px;
        }
        .number input{
            width: 70px;
            height: 100%;
            outline: none;
            background-color:#f7f7f9;
            border: 1px solid #f7f7f9;
            border-radius: 5px;
            font-size: 16px;
            text-indent: 10px;
        }
        .number_control{
            width: 20%;
            display: flex;
            flex-direction: column;
            transform: translateY(-3px);
            margin-right: 6px;
        }
        .number_control_item{
            display:block;
            flex:1;
            font-size: 25px;
            width: 30px;
            height: 15px;
        }
        .number_control_item:hover {
            color: #484848;
        }
        .main {
            display: flex;
            flex-direction: row;
            width: 100%;
            flex-wrap: wrap;
            justify-content: space-around;
            align-content: center;
        }
        .main_item{
            margin-top: 5px;
        }
        .main_item:hover{
            outline: 3px solid rgba(87,87,243,0.51);
        }
        .active{
        }
       .item {
          display:flex;
          justify-content: flex-start;
          align-items: flex-start;
          flex-direction: column;
          margin-bottom: 14px;
       }
       .title {
          width: 100%;
          height: 17px;
          font-size: 16px;
          display: flex;
          justify-content: flex-start;
          align-items: center;
          font-family: PingFang SC, PingFang SC-Regular;
          font-weight: 400;
          text-align: left;
          color: #7d7878;
          line-height: 17px;
          margin-bottom: 14px;
        }
    </style>
        `
        }, 'dom');


        dom.appendChild(str);
        // dom.addEventListener('click',(e)=>{
        //   dom.childNodes.forEach((i)=>{
        //     if(i.tagName !== 'style' && i.nodeType == 1){
        //       i.classList.remove('active');
        //     }
        //   });
        //   e.target.classList.add('active');
        // });
        return dom;
      }
    },
    {
      key: 'addSiblingNode',
      description: '用于新增某节点的子级节点，默认位于该节点之下',
      menu: {
        text: '新增同级节点',
        img: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMzRweCIgaGVpZ2h0PSIzNHB4IiB2aWV3Qm94PSIwIDAgMzQgMzQiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8dGl0bGU+5ZCM57qn6IqC54K5PC90aXRsZT4KICAgIDxkZWZzPgogICAgICAgIDxyZWN0IGlkPSJwYXRoLTEiIHg9IjkiIHk9IjgiIHdpZHRoPSIxNiIgaGVpZ2h0PSI3Ij48L3JlY3Q+CiAgICAgICAgPG1hc2sgaWQ9Im1hc2stMiIgbWFza0NvbnRlbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIG1hc2tVbml0cz0ib2JqZWN0Qm91bmRpbmdCb3giIHg9IjAiIHk9IjAiIHdpZHRoPSIxNiIgaGVpZ2h0PSI3IiBmaWxsPSJ3aGl0ZSI+CiAgICAgICAgICAgIDx1c2UgeGxpbms6aHJlZj0iI3BhdGgtMSI+PC91c2U+CiAgICAgICAgPC9tYXNrPgogICAgPC9kZWZzPgogICAgPGcgaWQ9Iumhtemdoi0xIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8ZyBpZD0i5Zu65a6aIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMjkwLjAwMDAwMCwgLTI3LjAwMDAwMCkiPgogICAgICAgICAgICA8ZyBpZD0i57yW57uELTLlpIfku70iIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE4Mi4wMDAwMDAsIDI0LjAwMDAwMCkiPgogICAgICAgICAgICAgICAgPGcgaWQ9IuWQjOe6p+iKgueCuSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTA4LjAwMDAwMCwgMy4wMDAwMDApIj4KICAgICAgICAgICAgICAgICAgICA8cmVjdCBpZD0i6YCP5piO5bqV5Zu+IiBmaWxsLW9wYWNpdHk9IjAiIGZpbGw9IiNGRkZGRkYiIHg9IjAiIHk9IjAiIHdpZHRoPSIzNCIgaGVpZ2h0PSIzNCI+PC9yZWN0PgogICAgICAgICAgICAgICAgICAgIDxyZWN0IGlkPSLnn6nlvaIiIHN0cm9rZT0iIzgxODE4NyIgeD0iOS41IiB5PSIxOC41IiB3aWR0aD0iMTUiIGhlaWdodD0iNiIgcng9IjEiPjwvcmVjdD4KICAgICAgICAgICAgICAgICAgICA8bGluZSB4MT0iMTciIHkxPSIxNSIgeDI9IjE3IiB5Mj0iMTgiIGlkPSLnm7Tnur8tNiIgc3Ryb2tlPSIjODE4MTg3IiBzdHJva2UtbGluZWNhcD0icm91bmQiPjwvbGluZT4KICAgICAgICAgICAgICAgICAgICA8dXNlIGlkPSLnn6nlvaLlpIfku70tNCIgc3Ryb2tlPSIjOUM5Q0E1IiBtYXNrPSJ1cmwoI21hc2stMikiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWRhc2hhcnJheT0iMiIgeGxpbms6aHJlZj0iI3BhdGgtMSI+PC91c2U+CiAgICAgICAgICAgICAgICA8L2c+CiAgICAgICAgICAgIDwvZz4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPg=='

      },
      // 监听事件名
      // event: 'click',
      /**
       * @description 事件对应的回调函数
       * @param self 返回该选项自身
       * @param pen 返回当前操作的pen对象
       * */
      // func: async (self,pen)=>{
      //   mindBoxPlugin.bottomChildren(pen,0);
      //   },
      popupEvent: 'mouseenter',
      shadowRoot: false,
      collapseEventOnMenu: false, // 是否在childrenDom中触发事件
      stopPropagation: true,
      collapseAnimate(self: FuncOption, pen: Pen, dom: HTMLElement) {
        dom.style.transformOrigin = 'top';
        dom.style.transition = 'all .3s';

        dom.style.transform = 'scaleY(0)';
        return true;
      },
      popupAnimate(self: FuncOption, pen: Pen, dom: HTMLElement) {
        dom.style.transform = 'scaleY(1)';
        return true;
      },
      popup: [
        {
          menu: {
            name: '',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" t="1698915834790" class="icon" viewBox="0 0 1365 1024" version="1.1" p-id="13181" width="50" height="30"><path d="M920.32924106 188.22098215H435.74469865c-178.43219866 0-323.49023438 145.05719866-323.49023438 323.49023436 0 178.43219866 145.05803572 323.49023438 323.49023438 323.49023439h484.58454241c178.43303572 0 323.49023438-145.05803572 323.49023437-323.49023439 0.14481026-178.28822544-144.91322544-323.49023438-323.49023437-323.49023436z m2.65345982 603.01339285H439.05440848c-145.05719866 0-281.40652902-137.4375-281.40652903-281.19475447 0-145.05803572 132.71735492-270.29966518 277.77455357-270.29966518h489.52064732c145.05803572 0 272.32700893 131.98995536 272.32700893 275.74720983 0 143.61328125-129.22935267 275.74720982-274.28738839 275.74720982z" p-id="13182"/></svg>',
          },
          event: 'click',
          func(self: FuncOption, pen: any, dom: HTMLElement, father: FuncOption) {
            let parent:any = meta2d.findOne(pen.mind.preNodeId);
            let index = parent.mind.children.indexOf(pen.id);
            mindBoxPlugin.addNode(parent, index + 1, 'mindNode2', {width: 200, height: 50});
            father.close();
          }
        },
        {
          menu: {
            name: '',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" t="1698916220010" class="icon" viewBox="0 0 1024 1024" version="1.1" p-id="13326" width="50" height="30"><path d="M485.213 869.904c6.744 4.822 18.199 8.603 26.787 8.603 8.588 0 21.779-2.476 28.32-7.442l467.957-336.878c13.427-9.665 13.47-26.284 0-35.915l-469.49-335.716c-6.726-4.81-19.733-10.927-28.321-10.927-8.588 0-23.313 7.122-29.855 12.088L15.723 498.272c-13.43 9.664-13.47 26.284 0 35.915z m23.719-671.51l452.01 322.481L512 835.227 63.058 518.553z" p-id="13327"/></svg>',
          },
          event: 'click',
          func(self: FuncOption, pen: any, dom: HTMLElement, father: FuncOption) {
            let parent:any = meta2d.findOne(pen.mind.preNodeId);
            let index = parent.mind.children.indexOf(pen.id);
            mindBoxPlugin.addNode(parent, index + 1, 'diamond', {width: 200, height: 120});
            father.close();
          }
        },
        {
          menu: {
            name: '',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="50px" height="30px" viewBox="0 0 140 53" version="1.1">\n' +
              '    <title>椭圆形备份 12</title>\n' +
              '    <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n' +
              '        <g id="未固定" transform="translate(-372.000000, -738.000000)" stroke="#000000" stroke-width="2">\n' +
              '            <ellipse id="椭圆形备份-12" cx="442" cy="764.5" rx="69" ry="25.5"/>\n' +
              '        </g>\n' +
              '    </g>\n' +
              '</svg>',
          },
          event: 'click',
          func(self: FuncOption, pen: any, dom: HTMLElement, father: FuncOption) {
            let parent:any = meta2d.findOne(pen.mind.preNodeId);
            let index = parent.mind.children.indexOf(pen.id);
            mindBoxPlugin.addNode(parent, index + 1, 'circle', {width: 200, height: 75});
            father.close();
          }
        }
      ],
    },
    {
      key: 'changeName',
      menu: {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="34px" height="34px" viewBox="0 0 34 34" version="1.1">\n' +
          '    <title>节点类型</title>\n' +
          '    <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n' +
          '        <g id="未固定" transform="translate(-434.000000, -138.000000)" fill="#818187" fill-rule="nonzero">\n' +
          '            <g id="编组-2" transform="translate(253.000000, 135.000000)">\n' +
          '                <g id="图元标记" transform="translate(181.000000, 3.000000)">\n' +
          '                    <g id="编组-2" transform="translate(8.000000, 7.000000)">\n' +
          '                        <path d="M1,5.29023514 C1.17996138,5.29023514 1.35658782,5.33879874 1.51125216,5.43080438 L8.81859469,9.77774525 C9.12163862,9.95801791 9.30734253,10.284566 9.30734253,10.637176 L9.30734253,19.1113447 C9.30734253,19.6636294 8.85962728,20.1113447 8.30734253,20.1113447 C8.13049278,20.1113447 7.95680621,20.0644449 7.80399333,19.9754278 L0.496650804,15.7187249 C0.189138547,15.5395916 0,15.2105245 0,14.8546418 L0,6.29023514 C0,5.73795039 0.44771525,5.29023514 1,5.29023514 Z M1,6.29023514 L1,14.8546418 L8.30734253,19.1113447 L8.30734253,10.637176 L1,6.29023514 Z" id="矩形"/>\n' +
          '                        <path d="M9.13847274,5.15451573 C9.31746803,5.15451573 9.49318237,5.20255964 9.64727631,5.29363309 L16.9004891,9.58046661 C17.2049191,9.76039253 17.3916855,10.0877237 17.3916855,10.4413492 L17.3916855,19.1172325 C17.3916855,19.6695172 16.9439702,20.1172325 16.3916855,20.1172325 C16.21583,20.1172325 16.0430842,20.0708584 15.8908716,19.9827875 L8.63765889,15.7860475 C8.32871653,15.6072921 8.13847274,15.2774223 8.13847274,14.9204925 L8.13847274,6.15451573 C8.13847274,5.60223098 8.58618799,5.15451573 9.13847274,5.15451573 Z M9.13847274,6.15451573 L9.13847274,14.9204925 L16.3916855,19.1172325 L16.3916855,10.4413492 L9.13847274,6.15451573 Z" id="矩形" transform="translate(12.765079, 12.635874) scale(-1, 1) translate(-12.765079, -12.635874) "/>\n' +
          '                        <path d="M9.23526615,0.136303242 L16.7563729,4.52525678 C17.2333795,4.80361472 17.3944161,5.41595868 17.1160581,5.89296528 C17.0252467,6.04858385 16.8940773,6.17677619 16.7364153,6.26399174 L9.24604725,10.4075176 C8.93653945,10.5787312 8.55960992,10.5737048 8.25477772,10.3942987 L0.733805872,5.96790268 C0.257836233,5.68777531 0.0990747117,5.07483757 0.379202089,4.59886793 C0.470610522,4.44355416 0.602291713,4.31582883 0.760320508,4.22919876 L8.25055366,0.123115448 C8.55835631,-0.0456193953 8.93209266,-0.0406141191 9.23526615,0.136303242 Z M8.73125451,1.0000001 L1.24102136,5.10608342 L8.76199321,9.53247945 L16.2523613,5.38895364 L8.73125451,1.0000001 Z" id="矩形备份-5" transform="translate(8.746693, 5.266240) scale(-1, 1) translate(-8.746693, -5.266240) "/>\n' +
          '                    </g>\n' +
          '                </g>\n' +
          '            </g>\n' +
          '        </g>\n' +
          '    </g>\n' +
          '</svg>'
      },
      description: '更改节点类型',
      popupEvent: 'mouseenter',
      shadowRoot: false,
      // collapseEventOnMenu:true, // 是否在childrenDom中触发事件
      stopPropagation: true,
      collapseAnimate(self: FuncOption, pen: Pen, dom: HTMLElement) {
        dom.style.transformOrigin = 'top';
        dom.style.transition = 'all .3s';

        dom.style.transform = 'scaleY(0)';
        return true;
      },
      popupAnimate(self: FuncOption, pen: Pen, dom: HTMLElement) {
        dom.style.transform = 'scaleY(1)';
        return true;
      },
      popup: [
        {
          menu: {
            icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" t="1698915834790" class="icon" viewBox="0 0 1365 1024" version="1.1" p-id="13181" width="50" height="30"><path d="M920.32924106 188.22098215H435.74469865c-178.43219866 0-323.49023438 145.05719866-323.49023438 323.49023436 0 178.43219866 145.05803572 323.49023438 323.49023438 323.49023439h484.58454241c178.43303572 0 323.49023438-145.05803572 323.49023437-323.49023439 0.14481026-178.28822544-144.91322544-323.49023438-323.49023437-323.49023436z m2.65345982 603.01339285H439.05440848c-145.05719866 0-281.40652902-137.4375-281.40652903-281.19475447 0-145.05803572 132.71735492-270.29966518 277.77455357-270.29966518h489.52064732c145.05803572 0 272.32700893 131.98995536 272.32700893 275.74720983 0 143.61328125-129.22935267 275.74720982-274.28738839 275.74720982z" p-id="13182"/></svg>',
          },
          event: 'click',
          name: 'mindNode2',
          func(self: FuncOption, pen: any, dom: HTMLElement, father: FuncOption) {
            pen.name = self.name;
            pen.calculative.name = self.name;
            meta2d.setValue({id: pen.id, width: 200, height: 50});
            father.close();
          }
        },
        {
          menu: {
            icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" t="1698916220010" class="icon" viewBox="0 0 1024 1024" version="1.1" p-id="13326" width="50" height="30"><path d="M485.213 869.904c6.744 4.822 18.199 8.603 26.787 8.603 8.588 0 21.779-2.476 28.32-7.442l467.957-336.878c13.427-9.665 13.47-26.284 0-35.915l-469.49-335.716c-6.726-4.81-19.733-10.927-28.321-10.927-8.588 0-23.313 7.122-29.855 12.088L15.723 498.272c-13.43 9.664-13.47 26.284 0 35.915z m23.719-671.51l452.01 322.481L512 835.227 63.058 518.553z" p-id="13327"/></svg>',
          },
          event: 'click',
          name: 'diamond',
          func(self: FuncOption, pen: any, dom: HTMLElement, father: FuncOption) {
            pen.name = self.name;
            pen.calculative.name = self.name;
            meta2d.setValue({id: pen.id, width: 200, height: 120});
            father.close();
          }
        },
        {
          menu: {
            icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="50px" height="30px" viewBox="0 0 140 53" version="1.1">\n' +
              '    <title>椭圆形备份 12</title>\n' +
              '    <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n' +
              '        <g id="未固定" transform="translate(-372.000000, -738.000000)" stroke="#000000" stroke-width="2">\n' +
              '            <ellipse id="椭圆形备份-12" cx="442" cy="764.5" rx="69" ry="25.5"/>\n' +
              '        </g>\n' +
              '    </g>\n' +
              '</svg>',
          },
          event: 'click',
          name: 'circle',
          func(self: FuncOption, pen: any, dom: HTMLElement, father: FuncOption) {
            pen.name = self.name;
            pen.calculative.name = self.name;
            meta2d.setValue({id: pen.id, width: 200, height: 50});
            father.close();
          }
        }
      ],
    }
    // {
    //   name:'button',
    //   event: 'click',
    //   func(){
    //   },
    //   popupEvent:'mouseenter',
    //   collapseEvent: 'mouseleave',
    //
    //  setChildrenDom(){
    //    // return '<ele-button></ele-button'
    //    return "<my-count name='caicai' onclick='(e)=>{e.stopPropagation()}' ></my-count>"
    //  },
    // }
  ];

export let defaultFuncs = {
  funcList,
  getAllFuncDocs() {
    return defaultFuncs.funcList.filter(i => i.menu).map(i => ({
      name: i.menu!.text || '暂无名称',
      key: i.key,
      description: i.description || '暂无描述'
    }));
  },
  getFunc(...key: any[]) {
    let result: any[] = [];
    if (Array.isArray(key)) {
      key.forEach((i) => {
        let func = defaultFuncs.funcList.find(j => j.key === i);
        func ? result.push(func) : console.warn(`[defaultFuncs warn]：No matching options ${i}`);
      });
    }
    return result;
  }
};
export let defaultFuncList: any = {
  'root': funcList.filter(i => i.key !== 'addSiblingNode' && i.key !== 'changeName'),
  'leaf': defaultFuncs.getFunc('addChildNode', 'addSiblingNode', 'changeName', 'extra', 'relayout', 'relayoutNext', 'extra', 'nodeStyle', 'lineStyle',)
};
export const toolboxDefault = {
  offset: 80,
  showControl: true
};

export let toolboxStyle = {
  backgroundColor: '#fff',
  borderRadius: '8px',
  boxShadow: '0px 6px 20px rgba(25,25,26,.06), 0px 2px 12px rgba(25,25,26,.04)',
  transform: 'translateX(-50%)',
  position: 'absolute',
  outline: 'none',
  userSelect: 'none',
  visibility: 'visibility',
  zIndex: 999,
  height: '42px',
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center'
};
export let funcListStyle = {
  boxSizing: 'content-box',
  width: 'max-content',
  height: '30px',
  padding: '6px',
  display: 'flex',
  alignItems: 'center',
};
export let controlStyle = {
  minWidth: '30px',
  opacity: '0.5',
  display: 'flex',
  cursor: 'pointer',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99,
  height: 'inherit',
  backgroundColor: "#efefef",
  flexDirection: 'column',
  borderRadius: '5px 0 0 5px'
};
export let extraStyle = {
  width: '1px',
  height: '60%',
  borderRadius: '5px',
  margin: '0 4px',
  backgroundColor: 'rgba(18,17,42,.1)',
};

export let basicFuncConfig = {
  collapseEventOnMenu: true,
  collapseEvent: 'click',
  popupEvent: 'mouseenter',
  shadowRoot: true
};
export default {
  funcList,
  colorList,
  controlStyle,
  extraStyle,
  defaultFuncList,
  basicFuncConfig
};

export let DefaultCssVar = {
  '--toolboxItem-hover-backgroundColor': '#eee',
  '--toolboxSliderItem-hover-backgroundColor': '#eee',
  '--toolbox-move-outLine': 'solid 2px #8585ff'
};
