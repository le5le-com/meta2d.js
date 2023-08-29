export function queryURLParams(value?: string) {
  let url = value || window.location.href.split('?')[1];
  const urlSearchParams = new URLSearchParams(url);
  const params = Object.fromEntries(urlSearchParams.entries());
  return params;
}
