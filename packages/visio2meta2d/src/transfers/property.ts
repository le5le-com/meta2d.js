export function getProperty(target,prop){
  let property = target[0];
  return Reflect.get(target,prop);
}


