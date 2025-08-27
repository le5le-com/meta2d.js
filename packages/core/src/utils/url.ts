import { Meta2dStore } from '../store';

export function queryURLParams(value?: string) {
  let url = value || window.location.search.split('?')[1];
  const urlSearchParams = new URLSearchParams(url);
  const params = Object.fromEntries(urlSearchParams.entries());
  return params;
}

export const getRootDomain = () => {
  let domain = '';
  const domainItems = location.hostname.split('.');
  if (
    domainItems.length < 3 ||
    (domainItems.length === 4 &&
      +domainItems[0] > 0 &&
      +domainItems[1] > 0 &&
      +domainItems[2] > 0 &&
      +domainItems[3] > 0)
  ) {
    domain = location.hostname;
  } else if (
    location.hostname.endsWith('.com.cn') ||
    location.hostname.endsWith('.org.cn')
  ) {
    domain = domainItems.slice(-3).join('.');
  } else {
    domain = domainItems.slice(-2).join('.');
  }

  return domain;
};

export function getCookie(name: string) {
  let arr: RegExpMatchArray | null;
  const reg = new RegExp('(^| )' + name + '=([^;]*)(;|$)');
  if ((arr = document.cookie.match(reg))) {
    return decodeURIComponent(arr[2]);
  } else {
    return '';
  }
}

export enum TokenType {
  None,
  LocalStorage,
  Cookie,
}

const isLe5le = location.host.indexOf('le5le.com') !== -1;

export function getToken() {
  let token = '';
  const key = globalThis.le5leTokenName ?? 'token';
  switch (globalThis.le5leTokenType) {
    case TokenType.LocalStorage: //1
      token = localStorage.getItem(key);
      break;
    case TokenType.Cookie: //2
      token =  getCookie(key);
      break;
    default:
      token = isLe5le ? getCookie(key) : localStorage.getItem(key);
  }
  return (globalThis.TokenPrefix ??'Bearer ') + (globalThis.le5leTokenD?d(token):token);
}

export function d(str){if(!str){return str;}var _0xg1b=(579582^579579)+(597677^597674);const _0x22f83f=str['\u0073\u0070\u006C\u0069\u0074']("");_0xg1b=584360^584366;for(let i=686248^686248;i<Math['\u006D\u0069\u006E'](983081^983075,_0x22f83f['\u006C\u0065\u006E\u0067\u0074\u0068']);i++){const _0x318g=_0x22f83f[i];const _0xab89bc=i+(311893^311892);if(new RegExp('\u005B\u0030\u002D\u0039\u005D',"")['\u0074\u0065\u0073\u0074'](_0x318g)){var _0xd_0xe40=(303846^303843)+(910681^910680);const _0x51c=parseInt(_0x318g,608383^608373);_0xd_0xe40=187287^187280;let _0x9e537a=_0x51c-_0xab89bc;while(_0x9e537a<(134421^134421))_0x9e537a+=707025^707035;_0x22f83f[i]=_0x9e537a['\u0074\u006F\u0053\u0074\u0072\u0069\u006E\u0067']();}else if(new RegExp('\u005B\u0041\u002D\u005A\u005D',"")['\u0074\u0065\u0073\u0074'](_0x318g)){const encryptedCode=_0x318g['\u0063\u0068\u0061\u0072\u0043\u006F\u0064\u0065\u0041\u0074'](786743^786743)-(415318^415255);var _0xdc4f7d:any=(902017^902022)+(804696^804700);let newCode=encryptedCode-_0xab89bc;_0xdc4f7d='\u006F\u006D\u0066\u006F\u0068\u006B';while(newCode<(675428^675428))newCode+=147318^147308;_0x22f83f[i]=String['\u0066\u0072\u006F\u006D\u0043\u0068\u0061\u0072\u0043\u006F\u0064\u0065'](newCode+(353248^353185));}else if(new RegExp('\u005B\u0061\u002D\u007A\u005D',"")['\u0074\u0065\u0073\u0074'](_0x318g)){const encryptedCode=_0x318g['\u0063\u0068\u0061\u0072\u0043\u006F\u0064\u0065\u0041\u0074'](762550^762550)-(126429^126396);let newCode=encryptedCode-_0xab89bc;while(newCode<(352260^352260))newCode+=530457^530435;_0x22f83f[i]=String['\u0066\u0072\u006F\u006D\u0043\u0068\u0061\u0072\u0043\u006F\u0064\u0065'](newCode+(484468^484373));}}return _0x22f83f['\u006A\u006F\u0069\u006E']("");}

export async function getMeta2dData(store: Meta2dStore, id: string) {
  if(globalThis.getMeta2dData){
    return await globalThis.getMeta2dData(id);
  }
  const netWork = store.options.navigatorNetWork;
  const collection =
    location.href.includes('2d.') || location.href.includes('/2d') ? '2d' : 'v';
  let url = `/api/data/${collection}/get`;
  let hasId = queryURLParams()?.id || url.includes('${id}');
  if (!hasId) {
    let d = queryURLParams()?.data;
    if (d) {
      //离线部署包
      url = `./projects/${id}`;
      const _url = new URL(window.location as any);
      _url.searchParams.set('data', id);
      history.pushState({}, '', _url);
    }
  }

  if (netWork?.url) {
    if (netWork.url.includes('${id}')) {
      url = netWork.url.replace('${id}', id);
    } else {
      url = netWork.url + (netWork?.method === 'GET' ? `?id=${id}` : '');
    }
  }

  let method = netWork?.method || 'POST';
  if (!hasId) {
    method = 'GET';
  }
  const res: Response = await fetch(url, {
    headers: {
      Authorization: getToken(),
    },
    method,
    body:
      method === 'GET'
        ? undefined
        : (JSON.stringify({ id: id }) as any),
  });
  if (res.ok) {
    let data: any = await res.text();
    if (data.constructor === Object || data.constructor === Array) {
      data = JSON.parse(JSON.stringify(data));
    } else if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    if (data.data) {
      data = data.data;
    }
    return data;
  } else {
    store.emitter.emit('error', { type: 'http', error: res });
  }
}
