import { Pen, setElemPosition } from '../pen';

export const videos: any = {};
export function video(pen: Pen) {
  pen.onDestroy = destory;
  pen.onMove = move;
  pen.onResize = move;
  pen.onRotate = move;
  pen.onClick = click;

  const worldRect = pen.calculative.worldRect;

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
    player.appendChild(progress);

    let media: HTMLMediaElement;
    if (pen.video) {
      media = document.createElement('video');
      media.src = pen.video;
    } else if (pen.audio) {
      media = document.createElement('audio');
      media.src = pen.audio;
    }
    media.loop = pen.playLoop;
    media.ontimeupdate = () => {
      // worldRect 会重新赋值，而 pen 不会变，这里才能取到实时的 worldRect
      progress.style.width = (media.currentTime / media.duration) * pen.calculative.worldRect.width + 'px';
    };
    media.onended = () => {
      pen.calculative.onended && pen.calculative.onended(pen);
    };
    // TODO: 调整 muted ，自动播放需要先静音
    media.onclick= () => {
      media.muted = false;
      if (media.paused) {
        media.play();
      } else {
        media.pause();
      }
    };
    pen.calculative.media = media;
    media.style.position = 'absolute';
    media.style.outline = 'none';
    media.style.left = '0';
    media.style.top = '0';
    media.style.width = '100%';
    media.style.height = '100%';
    player.appendChild(media);
    videos[pen.id] = player;
    pen.calculative.canvas.externalElements && pen.calculative.canvas.externalElements.appendChild(player);
    setElemPosition(pen, player);
    if (pen.autoPlay) {
      media.autoplay = true;
      media.muted = true; 
    }
  } else if (pen.video && pen.calculative.media && pen.video !== pen.calculative.video) {
    pen.calculative.media.src = pen.video;
    if (pen.autoPlay) {
      pen.calculative.media.muted = true; 
      pen.calculative.media.autoplay = true;
    }
    pen.calculative.video = pen.video;
  } else if (pen.audio && pen.calculative.media && pen.audio !== pen.calculative.audio) {
    pen.calculative.media.src = pen.audio;
    if (pen.autoPlay) {
      pen.calculative.media.muted = true; 
      pen.calculative.media.autoplay = true;
    }
    pen.calculative.audio = pen.audio;
  }
  if (pen.calculative.dirty) {
    setElemPosition(pen, videos[pen.id]);
  }
  return new Path2D();
}

function destory(pen: Pen) {
  videos[pen.id].remove();
  videos[pen.id] = undefined;
}

function move(pen: Pen) {
  setElemPosition(pen, videos[pen.id]);
}

function click(pen: Pen) {
  if (pen.calculative.media) {
    pen.calculative.media.muted = false;
    if (pen.calculative.media.paused) {
      pen.calculative.media.play();
    } else {
      pen.calculative.media.pause();
    }
  }
}
