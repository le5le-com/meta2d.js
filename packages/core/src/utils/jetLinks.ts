import { Meta2d } from "../core";
import { Network } from "../store";
import { getCookie } from "./url";
import { s8 } from "./uuid";
import { Pen } from "../pen";
import { Event } from "../event";

export function connectJetLinks(meta2d:Meta2d, net:Network){
  if (meta2d.jetLinksList.length) {
    meta2d.jetLinksClient = new WebSocket(
      `${net.url}/${
        localStorage.getItem('X-Access-Token') ||
        getCookie('X-Access-Token') ||
        new URLSearchParams(location.search).get('X-Access-Token') ||
        ''
      }`
    );
    //消息接收
    meta2d.jetLinksClient.onmessage = (e) => {
      const mess = JSON.parse(e.data);
      if (
        mess.payload &&
        // mess.payload.success &&
        mess.payload?.properties
      ) {
        const data = [];
        for (let key in mess.payload.properties) {
          if (!key.startsWith('_')) {
            data.push({
              id: `${mess.payload.headers.productId}#${mess.payload.deviceId}#${key}`,
              value: mess.payload.properties[key],
            });
          }
        }
        meta2d.setDatas(data, { history: false });
      }
    };
    meta2d.jetLinksClient.onopen = () => {
      meta2d.jetLinksList.forEach((item) => {
        meta2d.jetLinksClient.send(
          JSON.stringify({
            type: 'sub',
            topic: `/device${item.topic}/message/property/report`,
            parameter: {
              deviceId: item.deviceId,
              properties: item.properties,
              history: 1,
            },
            id: item.topic + '-' + s8(),
          })
        );
      });
    };
  }
}


export function closeJetLinks(meta2d:Meta2d){
  if(meta2d.jetLinksClient){
    meta2d.jetLinksClient.close();
    meta2d.jetLinksClient = undefined;
  }
}

export function getSendData(meta2d:Meta2d, pen: Pen, e: Event){
  const list: any = [];
  e.list.forEach((item: any, index) => {
    const _pen = item.params ? meta2d.findOne(item.params) : pen;
    list[index] = {
      deviceId: _pen.deviceId,
      productId: _pen.productId,
      properties: {},
    };
    for (let key in item.value) {
      if (item.value[key] === undefined || item.value[key] === '') {
        //找到绑定了这个设备属性的图元属性
        const realTime = _pen.realTimes?.find(
          (item: any) => item.propertyId === key
        );
        if (realTime) {
          list[index].properties[key] = _pen[realTime.key];
        }
      } else if (
        typeof item.value[key] === 'string' &&
        item.value[key]?.indexOf('${') > -1
      ) {
        let keys = item.value[key].match(/(?<=\$\{).*?(?=\})/g);
        if (keys?.length) {
          list[index].properties[key] =
            _pen[keys[0]] ?? meta2d.getDynamicParam(keys[0]);
        }
      } else {
        list[index].properties[key] = item.value[key];
      }
    }
  });

  return list;
}

export async function sendJetLinksData(meta2d:Meta2d, list:any[]){
  list.forEach(async (item) => {
    const res:any = await fetch(`/api/device-instance/${item.deviceId}/property`, {
      headers: {'X-Access-Token':localStorage.getItem('X-Access-Token') ||new URLSearchParams(location.search).get('X-Access-Token') ||''
      ,'Content-Type': 'application/json'},
      method: 'put',
      body: JSON.stringify(item.properties),
    });
    if (res.ok) {
      console.info('发送成功');
      meta2d.message({ theme: 'success', content: '下发成功' });
    }else{
      meta2d.message({ theme: 'error', content: '下发失败' });
    }
  });
}

// if (this.jetLinksClient && list.length) {
//   list.forEach((item) => {
//     this.jetLinksClient.send(
//       JSON.stringify({
//         type: 'sub',
//         topic: `/device-message-sender/${item.productId}/${item.deviceId}`,
//         parameter: {
//           messageType: 'WRITE_PROPERTY',
//           properties: item.properties,
//           headers: {
//             async: false,
//           },
//         },
//         id: item.productId + '/' + item.deviceId + '-' + s8(),
//       })
//     );
//   });
// }