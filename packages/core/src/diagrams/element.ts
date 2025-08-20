import { Pen } from '../pen';
import { s8 } from '../utils';
const EXTEND = 'extend';
const COMBINE = 'combine';
const PROPERTIES = 'properties';
const DOT = '.';
const TEXT = 'text';
const VALUE = 'value';
const DEFAULT = 'default';
const scene_regex = /sceneList\.\d+\.value/;
const cacheMap = {};
const cacheAnimateMap = {};
export function element(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  if (!pen.onDestroy) {
    pen.onDestroy = onDestroy;
    pen.onAdd = onAdd;
    pen.onValue = onValue;
    // pen.onBeforeValue = onBeforeValue;
    pen.onRenderPenRaw = onRenderPenRaw;
  }
  const path = !ctx ? new Path2D() : ctx;
  // 按需绘制path路径
  if (pen.needDraw) {
    const { x, y, width, height } = pen.calculative.worldRect;
    path.moveTo(x, y);
    path.lineTo(x + width, y);
    path.lineTo(x + width, y + height);
    path.lineTo(x, y + height);
    path.closePath();
  }
  updatePen(pen);
  if (path instanceof Path2D) {
    return path;
  }
}
function onRenderPenRaw(pen: Pen) {
}
function onAdd(pen: Pen) {
  let parentId = pen.id, child = [];
  fetch((pen as any).url)
    .then(response => {
      try {
        return response.json()
      } catch (error) {
        throw new Error(error);
      }
    })
    .then(res => {
      for (let i = 0; i < res.pens.length; i++) {
        const elem = res.pens[i];
        if (elem.name === COMBINE) {
          continue;
        } else {
          elem.parentId = parentId;
          elem.id = s8();
          for (const key in elem.properties) {
            if (Object.prototype.hasOwnProperty.call(elem.properties, key) && key !== EXTEND) {
              const value = elem.properties[key];
              for (const k in value) {
                if (Object.prototype.hasOwnProperty.call(value, k)) {
                  const v = value[k];
                  elem[k] = v;
                }
              }
            }
          }
          child.push(elem.id);
        }
        pen.calculative.canvas.makePen(elem);
        pen.calculative.canvas.parent.pushChildren(pen, [elem]);
      }
      const rect = pen.calculative.canvas.reversePenRect({ x: 0, y: 0, width: res.width, height: res.height });
      pen.width = rect.width;
      pen.height = rect.height;
      for (let i = 0; i < res.properties.length; i++) {
        const item = res.properties[i];
        item.value = item.defaultValue;
      }
      pen.properties = {
        extend: res.properties
      };
      // 根据extend的数据，初始化databinds的数据
      const arr = [];
      for (let i = 0; i < res.properties.length; i++) {
        const item = res.properties[i];
        const obj = {
          source: { dataId: '', name: '' },
          target: item.attr,
          function: null
        };
        arr.push(obj);
      }
      pen.databindings = arr;
      pen.children = child;
      pen.calculative.canvas.updatePenRect(pen);
    }).catch(err => {
      console.log(err);
    })
}
function onDestroy(pen: Pen) {

}
// function onBeforeValue(pen: Pen, value: any) {
//   console.log('beforeValue',pen,value);
//   return false;
//   const keys = pen.properties.extend.map(el=>el.attr);
//   // if()
// }
function onValue(pen: any, value: any) {
  console.log('onvalue', value)
  pen.realTimes?.forEach((realTime) => {
    if (realTime.key?.includes('.')) {
      delete pen[realTime.key];
    }
  });
  updatePen(pen, value);
}
function updatePen(pen: Pen, value?: any) {
  const meta2d = pen.calculative.canvas.parent;
  if (typeof value !== 'object') return;
  const kvs = Object.keys(value);
  const keys = pen.properties.extend.map(el => el.attr);
  const throughFlag = kvs.some(el => keys.includes(el));
  // console.log(kvs,'keys')
  // 走绑定透传控制这套逻辑
  if (throughFlag) {
    const targetAttr = kvs.filter(el=>el !== 'id')[0];
    let val = value[targetAttr]
    // console.log(val,'val')
    const targetKey = kvs.filter(el=>el !== 'id')[0];
    // console.log(value[targetKey],'value[targetKey]')
    const pIndex = pen.properties.extend.findIndex(el=>el.attr === targetKey);
    if(pIndex > -1){
      const parentKey = `properties.extend.${pIndex}.value`
      // 根据值类型，对设置的值做处理
      switch (pen.properties.extend[pIndex].valueType) {
        case "animation":
          val = parseInt(val);
          break;
        
        default:
          break;
      }
      meta2d.setValue({
        id: pen.id,
        [parentKey]: val
      }, { render: false, doEvent: false });
    }
    for (let i = 0; i < pen.children.length; i++) {
      const cId = pen.children[i];
      const child = meta2d.find(cId);
      if (!child[0]) continue;

      for (let j = 0; j < child[0].propBindings.length; j++) {
        const pb = child[0].propBindings[j];
        const exs = pen.properties.extend.find(el => el.attr === pb.src);
        // console.log('exs', exs,pb);
        // console.log('...................................',pen.targetAttr)
        // 如果不是当前修改的属性，则跳过设置
        if (targetAttr !== pb.src) continue;
        if (exs) {
          // console.log('hello',exs)
          const obj = { id: child[0].id };
          // const val = value[]
          // 除开内置属性的其他属性，更新流程都走properties.extend
          if (pb.type && pb.type !== DEFAULT) {
            // if (pb.type === EXTEND) {
            //   const index = child[0].properties.extend.findIndex(el => el.attr === pb.target);
            //   if (index !== -1) {
            //     Object.assign(obj, { [`${PROPERTIES}${DOT}${pb.type}${DOT}` + index + DOT + VALUE]: exs.value });
            //   }
            // } else {
            //   Object.assign(obj, { [PROPERTIES + DOT + pb.type + DOT + pb.target]: exs.value });
            // }
            if (pb.target === TEXT) {
              Object.assign(obj, { [TEXT]: val });
            }
          } else {
            if (exs.valueType === 'animation') {
              // console.log(exs.value,'animation')
              switch (exs.value) {
                case 0:
                  // stop animation
                  meta2d.stopAnimate(obj.id);
                  break;
                case 1:
                  // start animation
                  const kvs = pb.target.split(".");
                  meta2d.startAnimate(obj.id, parseInt(kvs[1]));
                  break;
                case 2:
                  // pause animation
                  meta2d.pauseAnimate(obj.id);
                  break;
                default:
                  break;
              }
            } else {
              // 内置属性走一级属性
              Object.assign(obj, { [pb.target]: val });
            }
          }
          // console.log('obj', obj);
          meta2d.setValue(obj, { render: false, doEvent: false });
        }
      }
    }
  }
  const sceneFlag = kvs.some(el=> el.startsWith("sceneList."));
  // 走状态场景这套逻辑
  if (sceneFlag) {
    const kvs = Object.entries(value);
    for (let i = 0; i < kvs.length; i++) {
      const kv = kvs[i];
      if (scene_regex.test(kv[0])) {
        // console.log(kv[0],kv[1])
        const currIndex = parseInt(kv[0].split(".")[1])
        const value = kv[1];
        if (value === 0) {
          // 0 默认状态
          recoverFromStatus(pen);
        } else {
          // 非0，执行状态，状态值减去1
          execStatus(pen, currIndex, value - 1)
        }
      }
    }
  }
}
function execStatus(pen: any, currIndex: number, value: number) {
  const meta2d = pen.calculative.canvas.parent;
  const scene = pen.sceneList[currIndex].scenes.find(el => el.key === value);
  const list = [];
  const antList = [];
  if (!scene || scene.status.length === 0) {
    recoverFromStatus(pen)
    return;
  }
  for (let i = 0; i < scene.status.length; i++) {
    const item = scene.status[i];
    // console.log('item',item)
    if (!item.id) {
      return;
    }
    if (item.target.length === 0) {
      return;
    }
    const pen = meta2d.store.data.pens.find(el => el.id === item.id);
    if (!cacheMap[pen.id]) {
      cacheMap[pen.id] = {}
    }
    if (!cacheAnimateMap[pen.id]) {
      cacheAnimateMap[pen.id] = {}
    }
    // statusMap[pen.id] = {}
    let obj = {
      id: pen.id
    }
    for (let j = 0; j < item.target.length; j++) {
      const elem = item.target[j];
      if (elem.value === "") {
        return;
      }
      // console.log('elem',elem.attr,pen.hasOwnProperty(elem.attr))
      if (pen.hasOwnProperty(elem.attr)) {
        if (!cacheMap[pen.id][elem.attr]) {
          cacheMap[pen.id][elem.attr] = pen[elem.attr]
        }
      }
      if (elem.attr === 'animation') {
        if (!cacheAnimateMap[pen.id][elem.attr]) {
          cacheAnimateMap[pen.id][elem.attr] = 'none';
        }
        antList.push([
          pen.id,
          elem.value
        ])
      }
      obj[elem.attr] = elem.value;
    }
    list.push(obj);
  }
  // console.log('cacheMap',cacheMap,list,antList)
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    meta2d.setValue(item, { render: false, doEvent: false })
  }
  meta2d.render();
  for (let i = 0; i < antList.length; i++) {
    const ant = antList[i];
    meta2d.startAnimate(...ant)
  }
  return 0;
}

function recoverFromStatus(pen: any) {
  const meta2d = pen.calculative.canvas.parent;
  if (!pen.children) return;
  const list = [];
  const antList = [];
  for (let i = 0; i < pen.children.length; i++) {
    const cId = pen.children[i];
    let obj = {
      id: cId
    }
    Object.assign(obj, cacheMap[cId]);
    list.push(obj);

    if (cacheAnimateMap[cId] && cacheAnimateMap[cId].hasOwnProperty("animation")) {
      antList.push(cId)
    }
  }
  for (let i = 0; i < list.length; i++) {
    const child = list[i];
    meta2d.setValue(child, { render: false, doEvent: false })
  }
  meta2d.render();
  // stop animation
  for (let i = 0; i < antList.length; i++) {
    const ant = antList[i];
    meta2d.stopAnimate(ant);
  }
}