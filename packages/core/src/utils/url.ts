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
  const key = globalThis.le5leTokenName ?? 'token';
  switch (globalThis.le5leTokenType) {
    case TokenType.LocalStorage:
      return localStorage.getItem(key);
    case TokenType.Cookie:
      return getCookie(key);
    default:
      const token = isLe5le ? getCookie(key) : localStorage.getItem(key);
      return token;
  }
}

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
      Authorization: `Bearer ${getToken()}`,
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
