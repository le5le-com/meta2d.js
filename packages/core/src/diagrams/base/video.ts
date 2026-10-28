import { Meta2d } from '../../meta2d';
import { Pen } from '../../models';

export const videoDefine = {
  type: 'video',
  create,
  destroy,
  afterUpdate,
  mouseUp,
  toPng,
};

const mutedIcons = [
  '<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M473.088 125.44L256 256H52.224C23.552 256 0 279.552 0 308.224V716.8c0 28.16 23.04 51.2 51.2 51.2h204.8l217.088 130.56c16.896 10.24 38.912-2.048 38.912-22.016V147.456c0-19.968-21.504-32.256-38.912-22.016zM699.904 320.512c-20.992-18.944-53.248-17.408-72.192 3.584-18.944 20.992-17.408 53.248 3.584 72.192 0.512 0.512 58.368 54.784 58.368 121.344 0 37.888-19.456 74.752-58.368 110.08-20.992 18.944-22.528 51.2-3.584 72.192 10.24 11.264 24.064 16.896 37.888 16.896 12.288 0 24.576-4.608 34.304-13.312 61.44-55.296 92.16-117.76 92.16-185.856 0-112.64-88.576-193.536-92.16-197.12z" fill="" p-id="2434"></path><path d="M853.504 166.4c-20.992-18.944-53.248-16.896-72.192 4.096-18.944 20.992-16.896 53.248 4.096 72.192 1.536 1.024 135.68 122.88 135.68 280.576 0 90.624-45.568 177.152-135.68 257.536-20.992 18.944-23.04 51.2-4.096 72.192 10.24 11.264 24.064 16.896 38.4 16.896 12.288 0 24.576-4.096 34.304-12.8 112.64-100.864 169.984-212.992 169.984-333.824-1.024-202.752-163.84-350.208-170.496-356.864z"></path></svg>',
  '<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" ><path d="M256 768H51.2c-28.16 0-51.2-23.04-51.2-51.2V308.224C0 279.552 23.552 256 52.224 256H256v512zM512 147.456v728.576c0 19.968-21.504 32.256-38.912 22.016L256 768V256l217.088-130.56c17.408-10.24 38.912 2.048 38.912 22.016zM623.104 656.896c-19.968-19.968-19.968-52.224 0-72.192l217.088-217.088c19.968-19.968 52.224-19.968 72.192 0 19.968 19.968 19.968 52.224 0 72.192l-217.088 217.088c-19.456 19.968-52.224 19.968-72.192 0z" fill="" p-id="2582"></path><path d="M623.104 367.104c19.968-19.968 52.224-19.968 72.192 0l217.088 217.088c19.968 19.968 19.968 52.224 0 72.192-19.968 19.968-52.224 19.968-72.192 0l-217.088-217.088c-19.968-19.456-19.968-52.224 0-72.192z"></path></svg>',
];

function create(this: Meta2d, pen: Pen) {
  let player = this.componentElementMap.get(pen.id);
  if (player) {
    return player;
  }
  player = document.createElement('div');
  const progress = document.createElement('div');
  progress.style.position = 'absolute';
  progress.style.outline = 'none';
  progress.style.left = '0';
  progress.style.bottom = '0';
  progress.style.width = '0';
  progress.style.height = '2px';
  progress.style.background = '#52c41a';
  progress.style.zIndex = '1';
  if ((pen as any).hideProgress) {
    progress.style.display = 'none';
  }
  const muted = document.createElement('div');
  muted.innerHTML = mutedIcons[1];
  muted.style.position = 'absolute';
  muted.style.right = '0';
  muted.style.bottom = '0';
  muted.style.width = '20px';
  muted.style.height = '20px';
  muted.style.fill = 'hsla(0, 0%, 100%, .8)';
  muted.style.zIndex = '1';
  muted.style.display = 'none';

  const scale = this.data.scale;
  player.style.position = 'absolute';
  player.style.left = pen.x * scale + this.data.x + 'px';
  player.style.top = pen.y * scale + this.data.y + 'px';
  player.style.width = pen.width * scale + 'px';
  player.style.height = pen.height * scale + 'px';
  player.appendChild(progress);
  player.appendChild(muted);

  let media: HTMLMediaElement;
  if (pen.audio) {
    media = document.createElement('audio');
    media.controls = (pen as any).controls;
    media.src = pen.audio;
  } else {
    media = document.createElement('video');
    media.src = pen.video;
    media.crossOrigin = pen.crossOrigin || 'anonymous';
  }

  media.loop = pen.playLoop;
  media.ontimeupdate = () => {
    const _pen = this.penMap.get(pen.id);
    if (!_pen) {
      return;
    }
    resizeProcessWidth(progress, media, _pen.width * this.data.scale);
  };

  media.style.position = 'absolute';
  media.style.outline = 'none';
  media.style.left = '0';
  media.style.top = '0';
  media.style.width = '100%';
  media.style.height = '100%';
  media.style.objectFit = (pen as any).objectFit || 'contain';

  muted.onclick = (e) => {
    e.stopPropagation();
    if (media.muted) {
      muted.innerHTML = mutedIcons[0];
      media.muted = false;
    } else {
      muted.innerHTML = mutedIcons[1];
      media.muted = true;
    }
  };

  player.onmouseenter = (e) => {
    if (!(pen as any).hideMuted) {
      muted.style.display = 'block';
    }
  };
  player.onmouseleave = (e) => {
    muted.style.display = 'none';
  };
  player.onclick = (e) => {
    e.stopPropagation();
    mouseUp.call(this, pen);
  };
  player.appendChild(media);

  if (pen.isBottom) {
    this.bottomElement.appendChild(player);
  } else {
    this.topElement.appendChild(player);
  }
  this.componentElementMap.set(pen.id, player);

  if (pen.autoPlay) {
    media.autoplay = true;
    media.muted = true;
  }

  return player;
}

function mouseUp(this: Meta2d, pen: Pen, e: any) {
  const player = this.componentElementMap.get(pen.id);
  const media = getMedia(player);
  if (media) {
    if (media.paused) {
      media.play();
    } else {
      media.pause();
    }
  }
}

function afterUpdate(this: Meta2d, pen: Pen, values: any): void {
  const player = this.componentElementMap.get(pen.id);
  const media = getMedia(player);
  if (!player || !media) {
    return;
  }
  const currentSrc = media.getAttribute('src');
  if (pen.video) {
    if (currentSrc !== pen.video) {
      media.src = pen.video;
    }
  } else if (pen.audio) {
    if (currentSrc !== pen.audio) {
      media.src = pen.audio;
    }
  }
  // TODO: 下面每次都改动，是否影响性能？
  if (pen.autoPlay) {
    media.muted = true;
    media.autoplay = true;
  }
  media.loop = pen.playLoop;
  const scale = this.data.scale;
  const progress = player.children[0] as HTMLDivElement;
  const width = values?.width ?? pen.width;
  resizeProcessWidth(progress, media, width * scale);
}

function destroy(this: Meta2d, pen: Pen) {
  const player = this.componentElementMap.get(pen.id);
  if (player) {
    player.remove();
  }
  this.componentElementMap.delete(pen.id);
}

function resizeProcessWidth(progress: HTMLDivElement, media: HTMLMediaElement, width: number) {
  if (!progress || !media || !media.duration || !Number.isFinite(media.duration)) {
    progress && (progress.style.width = '0');
    return;
  }
  progress.style.width = (media.currentTime / media.duration) * width + 'px';
}

function getMedia(player: HTMLElement) {
  return (
    player?.getElementsByTagName('video')[0] ||
    player?.getElementsByTagName('audio')[0]
  ) as HTMLMediaElement | undefined;
}

async function toPng(this: Meta2d, pen: Pen): Promise<ImageBitmap> {
  try {
    const player = this.componentElementMap.get(pen.id);
    const media = player?.getElementsByTagName('video')[0];
    if (
      !media ||
      media.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !media.videoWidth ||
      !media.videoHeight
    ) {
      return undefined;
    }

    const canvas = document.createElement('canvas');
    canvas.width = media.videoWidth;
    canvas.height = media.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    context.drawImage(media, 0, 0, canvas.width, canvas.height);
    return await createImageBitmap(canvas);
  } catch {
    // 跨域视频或未完成解码时可能无法读取当前帧，忽略该图元即可继续导出。
    return undefined;
  }
}
