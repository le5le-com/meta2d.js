export function createOffscreen(): any {
  try {
    const offscreen = new OffscreenCanvas(0, 0);
    const context = offscreen.getContext('2d');

    if (context && context.arc) {
      return offscreen;
    }

    return document.createElement('canvas');
  } catch (e) {
    return document.createElement('canvas');
  }
}
