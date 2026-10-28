import { getter } from './object';

export function getURLParams(value?: string) {
  let url = value || window.location.search.split('?')[1];
  const urlSearchParams = new URLSearchParams(url);
  const params = Object.fromEntries(urlSearchParams.entries());
  return params;
}

export function getCookies() {
  const cookies = document.cookie.split(';');
  const vars = {};
  for (const cookie of cookies) {
    const [k, v] = cookie.split('=');
    if (k && v !== undefined) {
      const key = k.trim();
      const value = decodeURIComponent(v.trim());
      vars[key] = value;
    }
  }

  return vars;
}

export function getCookie(name?: string) {
  let arr: RegExpMatchArray | null;
  const reg = new RegExp('(^| )' + name + '=([^;]*)(;|$)');
  if ((arr = document.cookie.match(reg))) {
    return decodeURIComponent(arr[2]);
  } else {
    return '';
  }
}

export function getLocalVars() {
  return Object.assign(getCookies(), localStorage, sessionStorage, getURLParams());
}

export function replaceStringTemplateVars(str: string, vars: Record<string, any>, sql?: boolean) {
  return str.replace(/\${(.*?)}/g, (match, key) => {
    const val = getter(vars, key);
    if (sql) {
      if (val == undefined) {
        return 'NULL';
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        return val.toString();
      } else if (val instanceof Date) {
        return `'${val.toISOString()}'`;
      } else {
        // 其它类型转成加引号的字符串。replace(/'/g, "''")防止字符串中包含单引号引起的注入攻击
        return `'${val.toString().replace(/'/g, "''")}'`;
      }
    }

    return val?.toString() || '';
  });
}

export function replaceJsonTemplateVars(json: any, vars: Record<string, any>, sql?: boolean) {
  for (const key in json) {
    if (json[key] === `\${${key}}`) {
      json[key] = getter(vars, key);
    } else if (typeof json[key] === 'string') {
      json[key] = replaceStringTemplateVars(json[key], vars, sql);
    } else if (typeof json[key] === 'object') {
      replaceJsonTemplateVars(json[key], vars);
    }
  }
  return json;
}
