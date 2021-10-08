/*
 * @Description: 
 * @Author: 高浩然
 * @Date: 2021-09-30 14:12:46
 * @LastEditTime: 2021-10-08 17:13:01
 */
const topology = new Le5le.Topology('topology');

const iconListDOM = document.querySelector('.icon-list');
getIconList().forEach(icon => {
  const { key, title, data } = icon;
  const div = document.createElement('div');
  const i = document.createElement('i');
  i.className = `iconfont icon-${ key }`;
  i.draggable = true;
  i.title = title;
  i.ondragstart = (e) => {
    e.dataTransfer.setData('Text', JSON.stringify(data));
  };
  div.appendChild(i);
  iconListDOM.appendChild(div);
});

const createBtn = document.querySelector('#create');
createBtn.onclick = () => {
  topology.open();
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
      topology.open(json);
    } catch {
      console.log('读取文件失败，请检查数据格式');
    }
  };
  reader.readAsText(file);
};

const saveBtn = document.querySelector('#save');
saveBtn.onclick = () => {
  const filename = '测试数据.json';
  const data = topology.data();
  const json = JSON.stringify(data, undefined, 4);
  const blob = new Blob([ json ], { type: 'text/json' });
  const a = document.createElement('a');
  a.download = filename;
  a.href = window.URL.createObjectURL(blob);
  a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
  a.click();
};

const penBtn = document.querySelector('#pen');
penBtn.onclick = () => {
  penBtn.className = 'active';
  pencilBtn.className = '';
  topology.drawLine('curve');
};

const pencilBtn = document.querySelector('#pencil');
pencilBtn.onclick = () => {
  if (penBtn.className === 'active') {
    return;
  }
  pencilBtn.className = 'active';
  topology.drawingPencil();
};

const helpBtn = document.querySelector('#help');
helpBtn.onclick = () => {
  window.open('https://www.yuque.com/alsmile/topology/cucep0');
};

window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'Escape':
      penBtn.className = '';
      pencilBtn.className = '';
      break;
    default:
      break;
  }
});

function getIconList () {
  return [
    { 
      key: 'rect',
      title: '矩形',
      data: {
        name: 'rectangle',
        text: '矩形',
        width: 100,
        height: 100
      }
    }, { 
      key: 'circle',
      title: '圆形',
      data: {
        name: 'circle',
        text: '圆形',
        width: 100,
        height: 100
      }
    }, { 
      key: 'img',
      title: '图片',
      data: {
        name: 'image',
        text: '图片',
        width: 100,
        height: 100
      }
    }, { 
      key: 'video',
      title: '视频',
      data: {
        name: 'video',
        width: 100,
        height: 100,
        video: 'http://clips.vorwaerts-gmbh.de/big_buck_bunny.mp4',
        autoPlay: true,
      }
    }, { 
      key: 'audio',
      title: '音频',
      data: {
        name: 'video',
        width: 100,
        height: 100,
        audio: 'https://down.ear0.com:3321/preview?soundid=37418&type=mp3',
        autoPlay: true,
      }
    }
  ];
}