import { composeFrames, readGifInfo } from 'gifwarp';
import UPNG from '@lvcabral/upng';
import { WorkerMessage } from '../../types';

type AnimatedBitmapFrame = {
  imageBitmap: ImageBitmap;
  duration: number;
};

const GIF_SIGNATURE = [0x47, 0x49, 0x46];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export async function onFetchImage(e: MessageEvent) {
  const imageBitmaps: ImageBitmap[] = [];
  let imageMap = {};
  const imagePens: any[] = [];
  let lastTime = performance.now();
  let imageCount = 0;

  for (const url of e.data.images || []) {
    try {
      const imageBitmap = await fetchImage(url);
      if (!imageBitmap) {
        continue;
      }

      const items = e.data.imagePens.filter((pen) => pen.image === url);
      imagePens.push(...items);
      imageBitmaps.push(imageBitmap);
      imageMap[url] = imageBitmap;

      const now = performance.now();
      imageCount += items.length;
      if (now - lastTime > 50 || imageCount >= e.data.imagePens.length) {
        lastTime = now;
        self.postMessage({ action: WorkerMessage.ImageFetched, imageMap, imagePens }, { transfer: imageBitmaps });
        imageBitmaps.length = 0;
        imagePens.length = 0;
        imageMap = {};
      }
    } catch (error) {
      console.error('处理图片错误:', url, error);
    }
  }

  if (!e.data.gifs || !e.data.gifs.length) {
    return;
  }

  // 请求并处理gif
  const gifImageBitmaps: ImageBitmap[] = [];
  let gifMap = {};
  const gifPens: any[] = [];
  const gifFailed: string[] = [];
  let gifCount = 0;
  for (const url of e.data.gifs) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const buff = await response.arrayBuffer();
      const animatedFrames = await decodeAnimatedFrames(buff);
      const gifFrames: AnimatedBitmapFrame[] = [];
      animatedFrames.forEach((frame) => {
        gifImageBitmaps.push(frame.imageBitmap);
        gifFrames.push(frame);
      });

      const items = e.data.gifPens.filter((pen) => pen.image === url);
      gifPens.push(...items);
      gifMap[url] = gifFrames;
      const now = performance.now();
      gifCount += items.length;
      if (now - lastTime > 50 || gifCount >= e.data.gifPens.length) {
        lastTime = now;
        self.postMessage({ action: WorkerMessage.ImageFetched, gifMap, gifPens }, { transfer: gifImageBitmaps });
        gifImageBitmaps.length = 0;
        gifPens.length = 0;
        gifMap = {};
      }
    } catch (error) {
      console.error('下载或解析动图错误:', url, error);
      gifFailed.push(url);
    }
  }

  if (gifFailed.length) {
    self.postMessage({ action: WorkerMessage.ImageFetched, gifFailed });
  }
}

async function decodeAnimatedFrames(buff: ArrayBuffer): Promise<AnimatedBitmapFrame[]> {
  if (isPngBuffer(buff)) {
    return decodePngFrames(buff);
  }

  if (isGifBuffer(buff)) {
    return decodeGifFrames(buff);
  }

  // 未知格式不能靠轮流调用解码器识别；SVG 由主线程加载，其他格式保留明确的错误提示。
  throw new Error('不支持的动图格式：仅支持 GIF 或 PNG/APNG');
}

function isGifBuffer(buff: ArrayBuffer): boolean {
  if (buff.byteLength < GIF_SIGNATURE.length) {
    return false;
  }
  const bytes = new Uint8Array(buff, 0, GIF_SIGNATURE.length);
  return GIF_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function isPngBuffer(buff: ArrayBuffer): boolean {
  if (buff.byteLength < PNG_SIGNATURE.length) {
    return false;
  }
  const bytes = new Uint8Array(buff, 0, PNG_SIGNATURE.length);
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

async function decodeGifFrames(buff: ArrayBuffer): Promise<AnimatedBitmapFrame[]> {
  const { width, height } = readGifInfo(buff);
  // gifwarp 会按照 GIF 的 disposal 规则合成整屏帧，避免渲染线程重复处理局部 patch。
  const frames = composeFrames(buff);
  const bitmaps: AnimatedBitmapFrame[] = [];

  for (const frame of frames) {
    const imageData = new ImageData(new Uint8ClampedArray(frame.rgba), width, height);
    const imageBitmap = await createImageBitmap(imageData);
    bitmaps.push({
      imageBitmap,
      duration: Math.max(frame.delay || 0, 1),
    });
  }

  return bitmaps;
}

async function decodePngFrames(buff: ArrayBuffer): Promise<AnimatedBitmapFrame[]> {
  const decodedImage = UPNG.decode(buff);
  const rgbaFrames = UPNG.toRGBA8(decodedImage);
  const bitmaps: AnimatedBitmapFrame[] = [];

  for (let i = 0; i < rgbaFrames.length; i++) {
    const rgba = rgbaFrames[i];
    const imageData = new ImageData(new Uint8ClampedArray(rgba), decodedImage.width, decodedImage.height);
    const imageBitmap = await createImageBitmap(imageData);
    bitmaps.push({
      imageBitmap,
      duration: Math.max(decodedImage.frames?.[i]?.delay || 0, 1),
    });
  }

  return bitmaps;
}

export async function fetchImage(url: string): Promise<ImageBitmap | undefined> {
  let response: Response;
  let blob: Blob;
  try {
    response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    blob = await response.blob();
    if (!blob.size) {
      throw new Error('Empty image blob');
    }
  } catch (error) {
    console.error('下载或解析图片错误:', url, error);
    return undefined;
  }

  try {
    return await createImageBitmap(blob);
  } catch (error) {
    const contentType = response.headers.get('content-type') || blob.type || 'unknown';
    console.error('图片解码失败:', url, { contentType, size: blob.size }, error);
    return undefined;
  }
}
