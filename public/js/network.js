/**
 * Backend WebSocket address. Hosted split (Netlify page + Render server): VITE_BACKEND_URL is
 * baked in at build time. Local dev (one server serves both): same origin as the page.
 */
export function socketUrl() {
  const configured = import.meta.env?.VITE_BACKEND_URL;
  const url = new URL('/ws', configured || location.href);
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  return url.href;
}

export class GameSocket {
  constructor(handlers) {
    this.handlers = handlers;
    this.attempt = 0;
    this.stopped = false;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket(socketUrl());
    this.ws.addEventListener('open', () => {
      this.attempt = 0;
      clearInterval(this.heart);
      this.heart = setInterval(() => this.send({ type: 'HEARTBEAT' }), 10000);
      this.handlers.onOpen?.();
    });
    this.ws.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      this.handlers.onMessage?.(message);
    });
    this.ws.addEventListener('close', () => {
      clearInterval(this.heart);
      this.handlers.onClose?.();
      if (this.stopped) return;
      const delay = Math.min(5000, 400 * 2 ** this.attempt);
      this.attempt += 1;
      this.timer = setTimeout(() => this.connect(), delay);
    });
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  close() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.ws?.close();
  }
}
