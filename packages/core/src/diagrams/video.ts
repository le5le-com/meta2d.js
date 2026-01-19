import { Pen, setElemPosition } from '../pen';

export const videos: {
  [id: string]: HTMLDivElement;
} = {};

const mutedIcons =['<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M473.088 125.44L256 256H52.224C23.552 256 0 279.552 0 308.224V716.8c0 28.16 23.04 51.2 51.2 51.2h204.8l217.088 130.56c16.896 10.24 38.912-2.048 38.912-22.016V147.456c0-19.968-21.504-32.256-38.912-22.016zM699.904 320.512c-20.992-18.944-53.248-17.408-72.192 3.584-18.944 20.992-17.408 53.248 3.584 72.192 0.512 0.512 58.368 54.784 58.368 121.344 0 37.888-19.456 74.752-58.368 110.08-20.992 18.944-22.528 51.2-3.584 72.192 10.24 11.264 24.064 16.896 37.888 16.896 12.288 0 24.576-4.608 34.304-13.312 61.44-55.296 92.16-117.76 92.16-185.856 0-112.64-88.576-193.536-92.16-197.12z" fill="" p-id="2434"></path><path d="M853.504 166.4c-20.992-18.944-53.248-16.896-72.192 4.096-18.944 20.992-16.896 53.248 4.096 72.192 1.536 1.024 135.68 122.88 135.68 280.576 0 90.624-45.568 177.152-135.68 257.536-20.992 18.944-23.04 51.2-4.096 72.192 10.24 11.264 24.064 16.896 38.4 16.896 12.288 0 24.576-4.096 34.304-12.8 112.64-100.864 169.984-212.992 169.984-333.824-1.024-202.752-163.84-350.208-170.496-356.864z"></path></svg>','<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" ><path d="M256 768H51.2c-28.16 0-51.2-23.04-51.2-51.2V308.224C0 279.552 23.552 256 52.224 256H256v512zM512 147.456v728.576c0 19.968-21.504 32.256-38.912 22.016L256 768V256l217.088-130.56c17.408-10.24 38.912 2.048 38.912 22.016zM623.104 656.896c-19.968-19.968-19.968-52.224 0-72.192l217.088-217.088c19.968-19.968 52.224-19.968 72.192 0 19.968 19.968 19.968 52.224 0 72.192l-217.088 217.088c-19.456 19.968-52.224 19.968-72.192 0z" fill="" p-id="2582"></path><path d="M623.104 367.104c19.968-19.968 52.224-19.968 72.192 0l217.088 217.088c19.968 19.968 19.968 52.224 0 72.192-19.968 19.968-52.224 19.968-72.192 0l-217.088-217.088c-19.968-19.456-19.968-52.224 0-72.192z"></path></svg>'];

export function video(pen: Pen) {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = move;
    pen.onRotate = move;
    pen.onClick = click;
    pen.onValue = value;
    pen.onChangeId = changeId;
  }

  if (!videos[pen.id]) {
    const player = document.createElement('div');

    const progress = document.createElement('div');
    progress.style.position = 'absolute';
    progress.style.outline = 'none';
    progress.style.left = '0';
    progress.style.bottom = '0';
    progress.style.width = '0';
    progress.style.height = '2px';
    progress.style.background = '#52c41a';
    progress.style.zIndex = '1';
    if((pen as any).hideProgress){
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
    player.appendChild(progress);
    player.appendChild(muted);

    muted.onclick = (e)=>{
      e.stopPropagation();
      if(pen.calculative.media.muted){
        muted.innerHTML = mutedIcons[0];
        pen.calculative.media.muted = false;
      }else{
        muted.innerHTML = mutedIcons[1];
        pen.calculative.media.muted = true;
      }
    }
    if(!pen.calculative.singleton){
      pen.calculative.singleton = {};
    }
    pen.calculative.singleton.muted = muted;
    player.onmouseenter = (e)=>{
      if(!(pen as any).hideMuted){
        muted.style.display = 'block';
      }
    }
    player.onmouseleave = (e)=>{
      muted.style.display = 'none';
    }
    player.onclick = (e)=>{
      e.stopPropagation();
      click(pen);
    }
    let media: HTMLMediaElement;
    if (pen.audio) {
      media = document.createElement('audio');
      media.controls = (pen as any).controls;
      media.src = pen.audio;
    } else {
      media = document.createElement('video');
      media.src = pen.video;
      media.crossOrigin = pen.crossOrigin || 'anonymous';
      (pen.calculative as any).img= media as HTMLVideoElement;
    }

    media.loop = pen.playLoop;
    media.ontimeupdate = () => {
      resizeProcessWidth(progress, media, pen.calculative.worldRect.width);
    };
    media.onended = () => {
      pen.calculative.onended && pen.calculative.onended(pen);
    };
    pen.calculative.media = media;
    media.style.position = 'absolute';
    media.style.outline = 'none';
    media.style.left = '0';
    media.style.top = '0';
    media.style.width = '100%';
    media.style.height = '100%';
    media.style.objectFit = (pen as any).objectFit || 'contain';
    player.appendChild(media);
    videos[pen.id] = player;
    pen.calculative.canvas.externalElements?.parentElement.appendChild(player);
    setElemPosition(pen, player);
    if (pen.autoPlay) {
      media.autoplay = true;
      media.muted = true;
    }
  } else if (
    pen.video &&
    pen.calculative.media &&
    pen.video !== pen.calculative.video
  ) {
    console.warn('video 更改, 此处是否执行？');
    pen.calculative.media.src = pen.video;
    if (pen.autoPlay) {
      pen.calculative.media.muted = true;
      pen.calculative.media.autoplay = true;
    }
    pen.calculative.media.loop = pen.playLoop;
    pen.calculative.video = pen.video;
  } else if (
    pen.audio &&
    pen.calculative.media &&
    pen.audio !== pen.calculative.audio
  ) {
    pen.calculative.media.src = pen.audio;
    if (pen.autoPlay) {
      pen.calculative.media.muted = true;
      pen.calculative.media.autoplay = true;
    }
    pen.calculative.media.loop = pen.playLoop;
    pen.calculative.audio = pen.audio;
  }
  if (pen.calculative.patchFlags) {
    setElemPosition(pen, videos[pen.id]);
  }
  return new Path2D();
}

function destory(pen: Pen) {
  videos[pen.id].onclick = null;
  videos[pen.id].remove();
  videos[pen.id] = undefined;
}

function move(pen: Pen) {
  setElemPosition(pen, videos[pen.id]);
  const progress = videos[pen.id].children[0];
  const media = videos[pen.id].children[1];
  resizeProcessWidth(
    progress as HTMLDivElement,
    media as HTMLMediaElement,
    pen.calculative.worldRect.width
  );
}

function click(pen: Pen) {
  if (pen.calculative.media) {
    pen.calculative.media.muted = false;
    pen.calculative.singleton.muted.innerHTML = mutedIcons[0];
    if (pen.calculative.media.paused) {
      pen.calculative.media.play();
    } else {
      pen.calculative.media.pause();
    }
  }
}
function resizeProcessWidth(
  progress: HTMLDivElement,
  media: HTMLMediaElement,
  width: number
) {
  // worldRect 会重新赋值，而 pen 不会变，这里才能取到实时的 worldRect
  progress.style.width = (media.currentTime / media.duration) * width + 'px';
}

function changeId(pen: Pen, oldId: string, newId: string) {
  if (!videos[oldId]) {
    return;
  }
  videos[newId] = videos[oldId];
  delete videos[oldId];
}

function value(pen: Pen) {
  const video = videos[pen.id];
  if (!video) {
    return;
  }
  setElemPosition(pen, video);
  if(!pen.calculative.media){
    pen.calculative.media = video.querySelector('video')
  }
  const currentSrc = pen.calculative.media.getAttribute('src');
  if (pen.video) {
    if (currentSrc !== pen.video) {
      pen.calculative.media.src = pen.video;
    }
  } else if (pen.audio) {
    if (currentSrc !== pen.audio) {
      pen.calculative.media.src = pen.audio;
    }
  }
  // TODO: 下面每次都改动，是否影响性能？
  if (pen.autoPlay) {
    pen.calculative.media.muted = true;
    // TODO: 自动播放何时关？
    pen.calculative.media.autoplay = true;
  }
  pen.calculative.media.loop = pen.playLoop;
}
