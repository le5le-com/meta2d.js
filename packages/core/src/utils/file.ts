export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target.result as string);
    };
    reader.onerror = (e) => {
      reject(e);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(
  file: File,
  url: string,
  params: Record<string, any>,
  headers: Record<string, string>
): Promise<string> {
  const formData = new FormData();
  // 后端接受的 formData 文件属性名一定为 file
  formData.append('file', file);
  if (params) {
    for (const key in params) {
      if (params.hasOwnProperty(key)) {
        formData.append(key, params[key]);
      }
    }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  // 后端返回的一级属性中，必须包含一个名为url的属性
  return (await res.json()).url;
}

export function loadCss(url: string, success?: any, error?: any) {
  var link = document.createElement('link');
  link.href = url;
  link.rel = 'stylesheet';
  success && (link.onload = success);
  error && (link.onerror = error);
  document.head.appendChild(link);
}
