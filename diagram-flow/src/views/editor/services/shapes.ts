export const shapes: any[] = [
  { name: '常用图形', show: true, list: [] },
  {
    name: '基本形状',
    show: true,
    list: [
      {
        name: '正方形',
        icon: 'l-rect',
        data: {
          type: 'square',
          width: 100,
          height: 100,
        },
      },
      {
        name: '文字',
        icon: 'l-text',
        data: {
          type: 'text',
          text: '文字',
          textAlign: 1,
          textVertical: 1,
          textAutoSize: true,
        },
      },
      {
        name: '图片',
        icon: 'l-picture',
        data: {
          type: 'image',
          width: 100,
          height: 100,
          image: '/logo.png',
        },
      },
      {
        name: 'Gif',
        svg: `<svg viewBox="0 0 950 900"><path d="M800 149.333333A138.666667 138.666667 0 0 1 938.666667 288v448.128a138.666667 138.666667 0 0 1-138.666667 138.666667H224A138.666667 138.666667 0 0 1 85.333333 736.128V288.042667A138.666667 138.666667 0 0 1 224 149.333333h576z m0 64H224A74.666667 74.666667 0 0 0 149.333333 288v448.128c0 41.258667 33.450667 74.666667 74.666667 74.666667h576a74.666667 74.666667 0 0 0 74.666667-74.666667V288.042667A74.666667 74.666667 0 0 0 800 213.333333zM341.973333 378.581333c25.429333 0 43.477333 3.456 64.085334 13.354667a26.666667 26.666667 0 0 1-23.082667 48.085333c-12.8-6.144-23.04-8.106667-41.002667-8.106666-36.992 0-64.170667 33.962667-64.170666 79.872 0 45.952 27.221333 80.042667 64.170666 80.042666 18.261333 0 33.749333-7.68 41.813334-21.333333L384 569.770667v-31.36l-16.042667 0.042666a26.666667 26.666667 0 0 1-26.368-22.698666L341.333333 511.829333c0-13.397333 9.856-24.448 22.741334-26.368l3.925333-0.298666h42.752c13.397333 0 24.448 9.856 26.368 22.741333l0.298667 3.925333-0.085334 66.048-0.256 2.346667-0.896 3.84-0.853333 2.346667c-16.085333 37.973333-52.949333 58.709333-93.354667 58.709333-69.376 0-117.504-60.245333-117.504-133.376 0-73.045333 48.085333-133.205333 117.504-133.205333z m196.864 5.205334c13.397333 0 24.490667 9.856 26.368 22.741333l0.298667 3.925333v203.178667a26.666667 26.666667 0 0 1-53.034667 3.925333l-0.298666-3.925333V410.453333c0-14.72 11.946667-26.666667 26.666666-26.666666z m127.829334 0L751.872 384a26.666667 26.666667 0 0 1 3.754667 53.034667l-3.925334 0.298666-58.496-0.213333v74.794667L741.12 512c13.397333 0 24.490667 9.898667 26.368 22.741333l0.298667 3.925334a26.666667 26.666667 0 0 1-22.741334 26.410666l-3.925333 0.256h-47.914667v47.573334a26.666667 26.666667 0 0 1-22.698666 26.368l-3.925334 0.298666a26.666667 26.666667 0 0 1-26.410666-22.741333l-0.256-3.925333V410.325333A26.666667 26.666667 0 0 1 662.698667 384l3.968-0.256z" fill="#3e3e3e" p-id="59574"></path></svg>`,
        data: {
          type: 'gif',
          width: 100,
          height: 100,
          image: '/camera.gif',
          autoPlay: true,
        },
      },
      {
        name: '圆角矩形',
        icon: 'l-rectangle',
        data: {
          width: 200,
          height: 50,
          borderRadius: 0.2,
          type: 'rectangle',
          lineCap: 'butt',
        },
      },
      {
        name: '圆',
        icon: 'l-circle',
        data: {
          width: 100,
          height: 100,
          type: 'circle',
          lineCap: 'butt',
        },
      },
      {
        name: '三角形',
        icon: 'l-triangle',
        data: {
          width: 100,
          height: 100,
          type: 'triangle',
        },
      },
      {
        name: '菱形',
        icon: 'l-diamond',
        data: {
          width: 100,
          height: 100,
          type: 'diamond',
        },
      },
      {
        name: '五边形',
        icon: 'l-pentagon',
        data: {
          width: 100,
          height: 100,
          type: 'pentagon',
        },
      },
      {
        name: '六边形',
        icon: 'l-hexagon',
        data: {
          width: 100,
          height: 100,
          type: 'hexagon',
        },
      },
      {
        name: '五角星',
        icon: 'l-pentagram',
        data: {
          width: 100,
          height: 100,
          type: 'pentagram',
        },
      },
      {
        name: '左箭头',
        icon: 'l-arrow-left',
        data: {
          width: 120,
          height: 60,
          type: 'leftArrow',
        },
      },
      {
        name: '右箭头',
        icon: 'l-arrow-right',
        data: {
          width: 120,
          height: 60,
          type: 'rightArrow',
        },
      },
      {
        name: '双向箭头',
        icon: 'l-twoway-arrow',
        data: {
          width: 150,
          height: 60,
          type: 'twowayArrow',
        },
      },
      {
        name: '云',
        icon: 'l-cloud',
        data: {
          width: 100,
          height: 100,
          type: 'cloud',
        },
      },
      {
        name: '消息框',
        icon: 'l-msg',
        data: {
          width: 100,
          height: 100,
          type: 'message',
        },
      },
      {
        name: '文件',
        icon: 'l-file',
        data: {
          width: 80,
          height: 100,
          type: 'file',
        },
      },
      {
        name: '立方体',
        icon: 'l-cube',
        data: {
          width: 60,
          height: 100,
          type: 'cube',
          z: 0.25,
          form: [
            {
              key: 'z',
              label: 'Z',
              type: 'number',
              min: 0,
              placeholder: '<= 1 即宽度的比例',
            },
            {
              key: 'backgroundFront',
              label: '前背景色',
              type: 'color',
            },
            {
              key: 'backgroundUp',
              label: '顶背景色',
              type: 'color',
            },
            {
              key: 'backgroundRight',
              label: '右背景色',
              type: 'color',
            },
          ],
        },
      },
      {
        name: '人',
        icon: 'l-people',
        data: {
          type: 'people',
          width: 70,
          height: 100,
        },
      },
      {
        name: '容器',
        icon: 'l-rect',
        data: {
          type: 'rectangle',
          width: 320,
          height: 160,
          container: { x: 0, y: 0, width: 1, height: 1 },
        },
      },
    ],
  },

  {
    name: '流程图',
    show: true,
    list: [
      {
        name: '开始/结束',
        icon: 'l-flow-start',
        data: {
          text: '开始/结束',
          width: 120,
          height: 40,
          borderRadius: 0.5,
          type: 'rectangle',
        },
      },
      {
        name: '流程',
        icon: 'l-rectangle',
        data: {
          text: '流程',
          width: 120,
          height: 40,
          type: 'rectangle',
        },
      },
      {
        name: '判定',
        icon: 'l-diamond',
        data: {
          text: '判定',
          width: 120,
          height: 60,
          type: 'diamond',
        },
      },
      {
        name: '数据',
        icon: 'l-flow-data',
        data: {
          text: '数据',
          width: 120,
          height: 50,
          type: 'flowData',
          offsetX: 0.14,
          form: [
            {
              key: 'offsetX',
              name: '斜率',
              type: 'number',
              min: 0,
              step: 0.1,
              placeholder: '<= 1 即宽度的比例',
            },
          ],
        },
      },
      {
        name: '准备',
        icon: 'l-flow-ready',
        data: {
          text: '准备',
          width: 120,
          height: 50,
          type: 'hexagon',
        },
      },
      {
        name: '子流程',
        icon: 'l-flow-subprocess',
        data: {
          text: '子流程',
          width: 120,
          height: 50,
          type: 'flowSubprocess',
        },
      },
      {
        name: '数据库',
        icon: 'l-db',
        data: {
          text: '数据库',
          width: 80,
          height: 120,
          type: 'flowDb',
        },
      },
      {
        name: '文档',
        icon: 'l-flow-document',
        data: {
          text: '文档',
          width: 120,
          height: 100,
          type: 'flowDocument',
        },
      },
      {
        name: '内部存储',
        icon: 'l-internal-storage',
        data: {
          text: '内部存储',
          width: 120,
          height: 80,
          type: 'flowInternalStorage',
        },
      },
      {
        name: '外部存储',
        icon: 'l-extern-storage',
        data: {
          text: '外部存储',
          width: 120,
          height: 80,
          type: 'flowExternStorage',
        },
      },
      {
        name: '队列',
        icon: 'l-flow-queue',
        data: {
          text: '队列',
          width: 100,
          height: 100,
          type: 'flowQueue',
        },
      },
      {
        name: '手动输入',
        icon: 'l-flow-manually',
        data: {
          text: '手动输入',
          width: 120,
          height: 80,
          type: 'flowManually',
        },
      },
      {
        name: '展示',
        icon: 'l-flow-display',
        data: {
          text: '展示',
          width: 120,
          height: 80,
          type: 'flowDisplay',
        },
      },
      {
        name: '并行模式',
        icon: 'l-flow-parallel',
        data: {
          text: '并行模式',
          width: 120,
          height: 50,
          type: 'flowParallel',
        },
      },
      {
        name: '注释',
        icon: 'l-flow-comment',
        data: {
          text: '注释',
          width: 100,
          height: 100,
          type: 'flowComment',
        },
      },
    ],
  },
  {
    name: '活动图',
    show: true,
    list: [
      {
        name: '开始',
        icon: 'l-inital',
        data: {
          text: '',
          width: 30,
          height: 30,
          type: 'circle',
          backgrounds: [{ type: 0, color: '#555' }],
          lineWidth: 0,
        },
      },
      {
        name: '结束',
        icon: 'l-final',
        data: {
          width: 30,
          height: 30,
          type: 'final',
        },
      },
      {
        name: '活动',
        icon: 'l-action',
        data: {
          text: '活动',
          width: 120,
          height: 50,
          type: 'rectangle',
        },
      },
      {
        name: '决策/合并',
        icon: 'l-diamond',
        data: {
          text: '决策/合并',
          width: 120,
          height: 50,
          type: 'diamond',
        },
      },
      {
        name: '垂直泳道',
        icon: 'l-swimlane-v',
        data: {
          text: '垂直泳道',
          width: 200,
          height: 500,
          type: 'swimlaneV',
        },
      },
      {
        name: '水平泳道',
        icon: 'l-swimlane-h',
        data: {
          text: '水平泳道',
          width: 500,
          height: 200,
          type: 'swimlaneH',
        },
      },
      {
        name: '垂直分岔/汇合',
        icon: 'l-fork-v',
        data: {
          text: '垂直分岔/汇合',
          width: 10,
          height: 150,
          type: 'rectangle',
          backgrounds: [{ type: 0, color: '#555' }],
        },
      },
      {
        name: '水平分岔/汇合',
        icon: 'l-fork',
        data: {
          text: '水平分岔/汇合',
          width: 150,
          height: 10,
          type: 'rectangle',
          backgrounds: [{ type: 0, color: '#555' }],
        },
      },
    ],
  },
  {
    name: '时序图和类图',
    show: true,
    list: [
      {
        name: '生命线',
        icon: 'l-lifeline',
        data: {
          text: '生命线',
          width: 150,
          height: 400,
          textHeight: 50,
          type: 'lifeline',
        },
      },
      {
        name: '激活',
        icon: 'l-focus',
        data: {
          text: '激活',
          width: 12,
          height: 200,
          type: 'rectangle',
        },
      },
      {
        name: '简单类',
        icon: 'l-simple-class',
        data: {
          text: 'Topolgoy',
          width: 270,
          height: 200,
          textHeight: 200,
          type: 'simpleClass',
          textAlign: 2,
          textVertical: 1,
          textTop: 10,
          list: [
            {
              text: '- name: string\n+ setName(name: string): void',
            },
          ],
        },
      },
      {
        name: '类',
        icon: 'l-class',
        data: {
          text: 'Topolgoy',
          width: 270,
          height: 200,
          textHeight: 200,
          type: 'interfaceClass',
          textAlign: 2,
          textVertical: 1,
          textTop: 10,
          list: [
            {
              text: '- name: string',
            },
            {
              text: '+ setName(name: string): void',
            },
          ],
        },
      },
    ],
  },

  {
    name: '故障树',
    show: true,
    list: [
      {
        name: '与门',
        icon: 'l-ANDmen',
        data: {
          type: 'andGate',
          width: 100,
          height: 150,
        },
      },
      {
        name: '基本事件',
        icon: 'l-jibenshijian',
        data: {
          type: 'basicEvent',
          width: 100,
          height: 150,
        },
      },
      {
        name: '未展开事件',
        icon: 'l-weizhankaishijian',
        data: {
          type: 'unexpandedEvent',
          width: 100,
          height: 150,
        },
      },
      {
        name: '优先AND门',
        icon: 'l-youxianANDmen',
        data: {
          type: 'priorityAndGate',
          width: 100,
          height: 150,
        },
      },
      {
        name: '禁止门',
        icon: 'l-jinzhimen',
        data: {
          type: 'forbiddenGate',
          width: 100,
          height: 150,
        },
      },
      {
        name: '事件',
        icon: 'l-shijian',
        data: {
          type: 'event',
          width: 100,
          height: 150,
        },
      },
      {
        name: '开关事件',
        icon: 'l-kaiguanshijian',
        data: {
          type: 'switchEvent',
          width: 100,
          height: 150,
        },
      },
      {
        name: '条件事件',
        icon: 'l-tiaojianshijian',
        data: {
          type: 'conditionalEvent',
          width: 150,
          height: 100,
        },
      },
      {
        name: '转移符号',
        icon: 'l-zhuanyifuhao',
        data: {
          type: 'transferSymbol',
          width: 100,
          height: 150,
        },
      },
      {
        name: '或门',
        icon: 'l-ORmen',
        data: {
          type: 'orGate',
          width: 100,
          height: 150,
        },
      },
      {
        name: '异或门',
        icon: 'l-yihuomen',
        data: {
          type: 'xorGate',
          width: 100,
          height: 150,
        },
      },
      {
        name: '表决门',
        icon: 'l-biaojuemen',
        data: {
          type: 'votingGate',
          width: 100,
          height: 150,
        },
      },
    ],
  },
];
