export class Socket {
  socket: WebSocket;
  fns: any = {};
  constructor(public url: string, public cb?: (e: any) => void) {
    this.init();
  }

  init() {
    this.socket = new WebSocket(this.url);
    this.socket.onmessage = this.cb;

    this.socket.onclose = () => {
      console.info('Canvas websocket closed and reconneting...');
      this.init();
    };
  }

  close() {
    this.socket.onclose = undefined;
    this.socket.close();
  }
}
