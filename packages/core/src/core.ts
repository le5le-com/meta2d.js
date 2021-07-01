import { EventType, Handler } from 'mitt';
import { Canvas } from './canvas';
import { Options } from './options';
import { TopologyData, TopologyStore, useStore } from './store';
import { s8 } from './utils';

declare const window: any;

export class Topology {
  store: TopologyStore;
  parentElement: HTMLElement;
  input = document.createElement('textarea');
  tooltip: HTMLElement;
  tooltipContent: HTMLElement;
  tooltipArrowUp: HTMLElement;
  tooltipArrowDown: HTMLElement;
  canvas = new Canvas();
  constructor(parent: string | HTMLElement, opts: Options = {}) {
    this.store = useStore(s8());
    this.setOptions(opts);
    this.init(parent);
    if (window) {
      window.topology = this;
    }
  }

  setOptions(opts: Options = {}) {
    this.store.options = Object.assign(this.store.options, opts);
  }

  getOptions() {
    return this.store.options;
  }

  private init(parent: string | HTMLElement) {
    if (typeof parent === 'string') {
      this.parentElement = document.getElementById(parent);
    } else {
      this.parentElement = parent;
    }

    this.input.style.position = 'absolute';
    this.input.style.zIndex = '-1';
    this.input.style.left = '-1000px';
    this.input.style.width = '0';
    this.input.style.height = '0';
    this.input.style.outline = 'none';
    this.input.style.border = '1px solid #cdcdcd';
    this.input.style.resize = 'none';
    this.parentElement.appendChild(this.input);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'topology-markdown';
    this.tooltip.style.position = 'fixed';
    this.tooltip.style.zIndex = '-1';
    this.tooltip.style.left = '-9999px';
    this.tooltip.style.padding = '8px 0';

    this.tooltipContent = document.createElement('div');
    this.tooltipContent.style.maxWidth = '320px';
    this.tooltipContent.style.outline = 'none';
    this.tooltipContent.style.borderRadius = '4px';
    this.tooltipContent.style.backgroundColor = 'rgba(0,0,0,.6)';
    this.tooltipContent.style.color = '#fff';
    this.tooltipContent.style.padding = '8px 16px';
    this.tooltipContent.style.lineHeight = '1.8';
    this.tooltipContent.style.overflowY = 'auto';
    this.tooltipContent.style.minHeight = '30px';
    this.tooltipContent.style.maxHeight = '400px';
    this.tooltip.appendChild(this.tooltipContent);

    this.tooltipArrowUp = document.createElement('div');
    this.tooltipArrowUp.className = 'arrow';
    this.tooltipArrowUp.style.position = 'absolute';
    this.tooltipArrowUp.style.border = '6px solid transparent';
    this.tooltipArrowUp.style.backgroundColor = 'transparent';
    this.tooltipArrowUp.style.left = '50%';
    this.tooltipArrowUp.style.transform = 'translateX(-50%)';
    this.tooltipArrowUp.style.top = '-4px';
    this.tooltip.appendChild(this.tooltipArrowUp);

    this.tooltipArrowDown = document.createElement('div');
    this.tooltipArrowDown.className = 'arrow';
    this.tooltipArrowDown.style.position = 'absolute';
    this.tooltipArrowDown.style.border = '6px solid transparent';
    this.tooltipArrowDown.style.left = '50%';
    this.tooltipArrowDown.style.transform = 'translateX(-50%)';
    this.tooltipArrowDown.style.backgroundColor = 'transparent';
    this.tooltipArrowDown.style.bottom = '-4px';
    this.tooltip.appendChild(this.tooltipArrowDown);

    this.parentElement.appendChild(this.tooltip);

    this.resize(this.parentElement.clientWidth, this.parentElement.clientHeight);
  }

  resize(width: number, height: number) {
    this.canvas.resize(width, height);
    this.canvas.render();
    this.store.emitter.emit('resize', { width, height });
  }

  open(data?: TopologyData) {
    if (data && data.mqttOptions && !data.mqttOptions.customClientId) {
      data.mqttOptions.clientId = s8();
    }

    this.store.emitter.emit('opened');
  }

  on(eventType: EventType, handler: Handler) {
    this.store.emitter.on(eventType, handler);
    return this;
  }

  off(eventType: EventType, handler: Handler) {
    this.store.emitter.off(eventType, handler);
    return this;
  }
}
