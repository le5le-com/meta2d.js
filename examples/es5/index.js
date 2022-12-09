/*
 * @Description:
 * @Author: 高浩然
 * @Date: 2021-09-30 14:12:46
 * @LastEditTime: 2021-10-14 13:42:00
 */
const meta2d = new Meta2d('meta2d');

const iconListDOM = document.querySelector('.icon-list');
getIconList().forEach((icon) => {
  const { key, title, data } = icon;
  const div = document.createElement('div');
  const i = document.createElement('i');
  i.className = `iconfont icon-${key}`;
  i.draggable = true;
  i.title = title;
  i.ondragstart = (e) => {
    e.dataTransfer.setData('Meta2d', JSON.stringify(data));
  };
  div.appendChild(i);
  iconListDOM.appendChild(div);
});

const createBtn = document.querySelector('#create');
createBtn.onclick = () => {
  meta2d.open();
};

const openInput = document.querySelector('#open-input');
openInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const json = JSON.parse(event.target.result);
      meta2d.open(json);
    } catch(e) {
      console.log('读取文件失败，请检查数据格式');
    }
  };
  reader.readAsText(file);
};

const saveBtn = document.querySelector('#save');
saveBtn.onclick = () => {
  const filename = '测试数据.json';
  const data = meta2d.data();
  const json = JSON.stringify(data, undefined, 4);
  const blob = new Blob([json], { type: 'text/json' });
  const a = document.createElement('a');
  a.download = filename;
  a.href = window.URL.createObjectURL(blob);
  a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
  a.click();
};

const penBtn = document.querySelector('#pen');
penBtn.onclick = () => {
  pencilBtn.className = '';
  meta2d.finishPencil();
  penBtn.className = 'active';
  meta2d.drawLine('curve');
};

const pencilBtn = document.querySelector('#pencil');
pencilBtn.onclick = () => {
  if (penBtn.className === 'active') {
    return;
  }
  if (pencilBtn.className === 'active') {
    pencilBtn.className = '';
    meta2d.finishPencil();
  } else {
    pencilBtn.className = 'active';
    meta2d.drawingPencil();
  }
};

const magnifierBtn = document.querySelector('#magnifier');
magnifierBtn.onclick = () => {
  if (magnifierBtn.className === 'active') {
    magnifierBtn.className = '';
    meta2d.hideMagnifier();
  } else {
    magnifierBtn.className = 'active';
    meta2d.showMagnifier();
  }
};

const minimapBtn = document.querySelector('#minimap');
minimapBtn.onclick = () => {
  if (minimapBtn.className === 'active') {
    minimapBtn.className = '';
    meta2d.hideMap();
  } else {
    minimapBtn.className = 'active';
    meta2d.showMap();
  }
};

const helpBtn = document.querySelector('#help');
helpBtn.onclick = () => {
  window.open('https://www.yuque.com/alsmile/topology/cucep0');
};

window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'b':
    case 'B':
      if (meta2d.canvas.pencil) {
        pencilBtn.className = 'active';
      } else {
        pencilBtn.className = '';
      }
      break;
    case 'v':
    case 'V':
      if (e.ctrlKey || e.metaKey) {
        return;
      } else {
        if (meta2d.canvas.drawingLineName) {
          penBtn.className = 'active';
        } else {
          penBtn.className = '';
        }
      }
      break;
    case 'm':
    case 'M':
      if (meta2d.canvas.magnifier) {
        minimapBtn.className = 'active';
      } else {
        minimapBtn.className = '';
      }
      break;
    case 'Escape':
      penBtn.className = '';
      pencilBtn.className = '';
      magnifierBtn.className = '';
      break;
    default:
      break;
  }
});

function getIconList() {
  return [
    {
      key: 'rect',
      title: '矩形',
      data: {
        name: 'rectangle',
        text: '矩形',
        width: 100,
        height: 100,
      },
    },
    {
      key: 'circle',
      title: '圆形',
      data: {
        name: 'circle',
        text: '圆形',
        width: 100,
        height: 100,
        events: [
          {
            name: 'click',
            action: 7,
            value: 'showDialog',
          },
        ],
      },
    },
    {
      key: 'img',
      title: '图片',
      data: {
        name: 'image',
        width: 100,
        height: 100,
        image:
          'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fimg.zcool.cn%2Fcommunity%2F016ba9554b952b000001bf72fa6574.jpg%402o.jpg&refer=http%3A%2F%2Fimg.zcool.cn&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=jpeg?sec=1636344024&t=f977b8ad47acf62ee3579d594f32489a',
      },
    },
    {
      key: 'video',
      title: '视频',
      data: {
        name: 'video',
        width: 100,
        height: 100,
        video: 'http://clips.vorwaerts-gmbh.de/big_buck_bunny.mp4',
        autoPlay: true,
      },
    },
    {
      key: 'audio',
      title: '音频',
      data: {
        name: 'video',
        width: 100,
        height: 100,
        audio: 'https://down.ear0.com:3321/preview?soundid=37418&type=mp3',
        autoPlay: true,
      },
    },
  ];
}
