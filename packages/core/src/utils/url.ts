export function queryURLParams(value?: string) {
  let url = value || window.location.href.split('?')[1];
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
