// const obj = {a:{b:[0,1,2]}}
// getter(obj, 'a.b.1')
export function getter(object: any, path: string) {
  if (path == undefined) {
    return object;
  }
  const arr = path.split('.');
  while (arr.length && (object = object[arr.shift()]));
  return object;
}

// setter(obj, 'a.b.1', 111)
export function setter(object: any, path: string, value: any) {
  if (path == undefined) {
    return;
  }
  path
    .split('.')
    .reduce(
      (o, p, i) => (o[p] = path.split('.').length === ++i ? value : o[p] || {}),
      object
    );
}
