export function isEvent(key: string) {
  return key.startsWith('on');
}

export function isOnceEvent(key: string) {
  if (!isEvent(key)) return false;
  return key.endsWith('Once');
}

export function getEventName(key: string) {
  if (isOnceEvent(key)) return key.slice(0, -4);
  else return key;
}
