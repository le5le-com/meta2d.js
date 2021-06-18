import * as mqtt from 'mqtt/dist/mqtt.min.js';

export class MQTT {
  client: any;
  fns: any = {};
  constructor(public url: string, public options: any, public topics: string, public cb?: (topic: string, message: any) => void) {
    this.init();
  }

  init() {
    this.client = mqtt.connect(this.url, this.options);
    this.client.on('message', this.cb);

    if (this.topics) {
      this.client.subscribe(this.topics.split(','));
    }
  }

  publish(topic: string, message: string) {
    this.client.publish(topic, message);
  }

  close() {
    this.client.end();
  }
}
