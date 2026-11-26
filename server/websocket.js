import { timingSafeEqual } from 'crypto';
import { controllerUrl } from './hostInfo.js';
import { parseMessage } from './messageHandler.js';
import { makeQrDataUrl } from './qrManager.js';

function send(ws, message) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
}

function tokensMatch(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

function allow(ws, bucket, limit, windowMs) {
  const now = Date.now();
  const rates = ws.rates || (ws.rates = {});
  const stamps = rates[bucket] || (rates[bucket] = []);
  while (stamps.length && now - stamps[0] > windowMs) stamps.shift();
  if (stamps.length >= limit) return false;
  stamps.push(now);
  return true;
}

function forwardInput(session) {
  send(session.game, {
    type: 'PLAYER_INPUT',
    x: session.x,
    fire: session.fire,
  });
}

export function attachWebSocket(wss, { sessions, getBaseUrl }) {
  async function describe(session) {
    const baseUrl = getBaseUrl();
    const url = controllerUrl(baseUrl, session.id, session.token);
    return {
      type: 'SESSION',
      sessionId: session.id,
      token: session.token,
      hostToken: session.hostToken,
      controllerUrl: url,
      qr: await makeQrDataUrl(url),
      reachable: !baseUrl.includes('localhost'),
      setupUrl: new URL('/setup', baseUrl).toString(),
      controllerConnected: Boolean(session.controller && session.controller.readyState === 1),
    };
  }

  function detach(ws) {
    const session = sessions.get(ws.sessionId);
    if (!session) return;
    sessions.touch(session);
    if (session.game === ws) session.game = null;
    if (session.controller === ws) {
      session.controller = null;
      session.fire = false;
      session.x = 0;
      send(session.game, { type: 'CONTROLLER_DISCONNECTED' });
      forwardInput(session);
    }
  }

  async function host(ws, message) {
    if (!allow(ws, 'host', 8, 10000)) return;
    let session = null;
    if (message.sessionId) {
      session = sessions.get(message.sessionId);
      // Only the host secret can re-take a game screen; the QR pairing token cannot.
      if (!session || !tokensMatch(session.hostToken, message.token)) {
        send(ws, { type: 'ERROR', code: 'BAD_SESSION' });
        return;
      }
    } else {
      session = sessions.create();
    }
    // A game that switches sessions (Reconnect) retires the old one so its phone cannot keep steering.
    const previous = ws.sessionId && ws.sessionId !== session.id ? sessions.get(ws.sessionId) : null;
    if (previous && previous.game === ws) {
      previous.game = null;
      send(previous.controller, { type: 'ERROR', code: 'SESSION_ENDED' });
      previous.controller?.close();
      sessions.remove(previous.id);
    }
    if (session.game && session.game !== ws) session.game.close();
    session.game = ws;
    ws.role = 'game';
    ws.sessionId = session.id;
    sessions.touch(session);
    send(ws, await describe(session));
    if (session.controller && session.controller.readyState === 1) {
      send(ws, { type: 'CONTROLLER_CONNECTED' });
      forwardInput(session);
    }
  }

  function pair(ws, message) {
    if (!allow(ws, 'pair', 6, 10000)) return;
    const session = sessions.get(message.sessionId);
    if (!session || !tokensMatch(session.token, message.token)) {
      send(ws, { type: 'ERROR', code: 'BAD_SESSION' });
      return;
    }
    if (session.controller && session.controller !== ws && session.controller.readyState === 1) {
      send(ws, { type: 'ERROR', code: 'CONTROLLER_TAKEN' });
      return;
    }
    session.controller = ws;
    ws.role = 'controller';
    ws.sessionId = session.id;
    sessions.touch(session);
    send(ws, { type: 'PAIRED', sessionId: session.id });
    send(session.game, { type: 'CONTROLLER_CONNECTED' });
  }

  function onMessage(ws, message) {
    if (message.type === 'HOST') {
      host(ws, message);
      return;
    }
    if (message.type === 'PAIR') {
      pair(ws, message);
      return;
    }
    if (message.type === 'HEARTBEAT') {
      ws.isAlive = true;
      return;
    }
    if (ws.role !== 'controller') {
      send(ws, { type: 'ERROR', code: 'NOT_PAIRED' });
      return;
    }
    const session = sessions.get(ws.sessionId);
    if (!session || session.controller !== ws) return;
    sessions.touch(session);

    if (message.type === 'MOVE') {
      if (!allow(ws, 'move', 70, 1000)) return;
      session.x = message.x;
      forwardInput(session);
      return;
    }
    if (message.type === 'FIRE') {
      if (!allow(ws, 'fire', 30, 1000)) return;
      session.fire = message.pressed;
      forwardInput(session);
      return;
    }
    if (message.type === 'SPECIAL') {
      if (!allow(ws, 'special', 2, 1000)) return;
      send(session.game, { type: 'SPECIAL_ATTACK' });
      return;
    }
    if (message.type === 'PAUSE') {
      if (!allow(ws, 'pause', 4, 1000)) return;
      send(session.game, { type: 'PAUSE' });
    }
  }

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary || data.length > 4096) {
        send(ws, { type: 'ERROR', code: 'BAD_MESSAGE' });
        return;
      }
      const parsed = parseMessage(data.toString());
      if (!parsed.ok) {
        send(ws, { type: 'ERROR', code: parsed.error });
        return;
      }
      Promise.resolve(onMessage(ws, parsed.message)).catch(() => {
        send(ws, { type: 'ERROR', code: 'SERVER' });
      });
    });
    ws.on('close', () => detach(ws));
  });

  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
    sessions.sweep();
  }, 15000);
  timer.unref?.();

  return () => clearInterval(timer);
}
