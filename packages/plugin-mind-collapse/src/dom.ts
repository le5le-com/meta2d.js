import {collapseChildPlugin, _toolBoxPlugin, MyPen} from "./core/CollapseChildPlugin";
import {defaultConfig, defaultStyle} from "./core/default";
import {Meta2d} from "@meta2d/core";

declare const meta2d: Meta2d;

export class CollapseButton {
  // icon = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" t="1695196647299" class="icon" viewBox="0 0 1024 1024" version="1.1" p-id="15005" width="200" height="200"><path d="M353.96380445 470.37781333c-28.69589333 26.00504889-28.30791111 68.80711111 0.94776888 94.40711112l329.83722667 288.60643555c9.45834667 8.27619555 23.83416889 7.31704889 32.11036445-2.14129778s7.31704889-23.83416889-2.14129778-32.11036444l-329.83722667-288.60643556c-8.78023111-7.68227555-8.87921778-18.71075555-0.35612445-26.43399111l330.48803556-299.50520889c9.31157333-8.43889778 10.02040889-22.82951111 1.58037334-32.14222222-8.43889778-9.31157333-22.82951111-10.02040889-32.14222223-1.58037333l-330.48803555 299.50520888z" p-id="15006" fill="#ffffff"/></svg>';
  count = 0;
  collapseIcon = null;
  extendIcon = null;
  box: HTMLElement;

  constructor(parentHtml, style = {}) {
    this.box = document.createElement('div');
    // this.box.style.padding = '2px';
    this.setStyle(defaultStyle);
    this.box.className = 'hide_button';

    this.setStyle(style);
    parentHtml.appendChild(this.box);
  }
  onClick() {
    if ((this as MyPen).mind.childrenVisible) {
      let count = collapseChildPlugin.collapse(this);
      (this as MyPen).mind.singleton.collapseButton.setExtendIcon(count);

      // 从当前节点处更新
      _toolBoxPlugin.update(meta2d.findOne((this as MyPen).mind.rootId));
    } else {
      collapseChildPlugin.extend(this, false);
      (this as MyPen).mind.singleton.collapseButton.setCollapseIcon();
      _toolBoxPlugin.update(meta2d.findOne((this as MyPen).mind.rootId));
    }
  }

  /***
   * @description 设置图标 支持dom和
   */
  setCollapseIcon(icon?:string | HTMLElement) {
    if (icon instanceof HTMLElement) {
      this.box.innerHTML = ``;
      this.box.appendChild(icon);
      this.collapseIcon = icon;
      return;
    }
    if (typeof icon === 'string') {
      this.collapseIcon = icon;
    }
    this.box.innerHTML = this.collapseIcon || defaultConfig.collapseIcon;
  }

  // 折叠子项 level为折叠层数 默认则折叠所有子项

  setStyle(style) {
    // 加载默认配置
    this.loadDefault();
    Object.keys(style).forEach(i => {
      this.box.style[i] = style[i];
    });
  }

  loadDefault() {
    Object.keys(defaultStyle).forEach(key => {
      this.box.style[key] = defaultStyle[key];
    });
  }

  setExtendIcon(icon?:string| number | HTMLElement) {
    if (this.extendIcon) {
      this.box.innerHTML = this.extendIcon;
      return;
    }

    if (icon instanceof HTMLElement) {
      this.box.innerHTML = ``;
      this.extendIcon = icon;
      this.box.appendChild(icon);
      return;
    }

    if (typeof icon === 'string') {
      this.extendIcon = icon;
      this.box.innerHTML = this.extendIcon;
    } else if (typeof icon === "number") {
      this.box.innerHTML = icon + '';
    }
  }

  destroy() {
    this.box.parentNode.removeChild(this.box);
  }

  hide() {
    this.box.style.visibility = 'hidden';
  }

  show() {
    this.box.style.visibility = 'visible';
  }

  bindPen(penId) {
    let pen:MyPen = meta2d.findOne(penId);
    this.box.onclick = this.onClick.bind(pen);
    if (pen.mind.childrenVisible) {
      this.setCollapseIcon();
    } else {
      this.setExtendIcon();
    }
  }

  translatePosition(pen, direction) {
    // this.hide();
    const store = pen.calculative.canvas.store;
    const worldRect = pen.calculative.worldRect;
    if (!direction) direction = pen.mind.collapse.config?.direction || pen.mind.direction;
    this.box.style.position = 'absolute';
    this.box.style.outline = 'none';
    this.box.style.zIndex = '10';
    let pos = {
      x: "-999",
      y: "-999"
    };
    switch (direction) {
      case 'right':
        pos.x = worldRect.x + store.data.x + worldRect.width + 6 + 'px';
        pos.y = worldRect.y + store.data.y + worldRect.height / 2 + 'px';
        this.box.style.transform = "translateY(-50%)";

        break;
      case 'left':
        pos.x = worldRect.x + store.data.x - 20 + 'px';
        pos.y = worldRect.y + store.data.y + worldRect.height / 2 + 'px';
        this.box.style.transform = "translateY(-50%)";

        break;
      case 'top':
        pos.x = worldRect.x + store.data.x + worldRect.width / 2 + 'px';
        pos.y = worldRect.y + store.data.y + -20 + 'px';
        this.box.style.transform = "translateX(-50%)";

        break;
      case 'bottom':
        pos.x = worldRect.x + store.data.x + worldRect.width / 2 + 'px';
        pos.y = worldRect.y + store.data.y + worldRect.height + 6 + 'px';
        this.box.style.transform = "translateX(-50%)";

        break;
      default :
        if (pen.mind.collapse?.offset) {
          pos.x = worldRect.x + store.data.x + worldRect.width + 6 + pen.mind.collapse.offset.x + 'px';
          pos.y = worldRect.y + store.data.y + worldRect.height / 2 + pen.mind.collapse.offset.y + 'px';
        } else {
          pos.x = worldRect.x + store.data.x + worldRect.width + 6 + 'px';
          pos.y = worldRect.y + store.data.y + worldRect.height / 2 + 'px';
        }

    }
    this.box.style.left = pos.x;
    this.box.style.top = pos.y;
    this.box.style.userSelect = 'none';
    // this.show();
  }

}
