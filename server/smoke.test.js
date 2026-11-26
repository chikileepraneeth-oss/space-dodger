import assert from 'node:assert/strict';
import test from 'node:test';
import WebSocket from 'ws';
import { startServer } from '../server.js';

function openSocket(port) {
  const ws = new WebSocket(`wss://127.0.0.1:${port}/ws`, { rejectUnauthorized: false });
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function nextMatch(ws, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message')), 5000);
    const onMessage = (buf) => {
      const message = JSON.parse(buf.toString());
      if (!predicate(message)) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(message);
    };
    ws.on('message', onMessage);
  });
}

test('pairs one controller and forwards only that session', { timeout: 30000 }, async () => {
  const server = await startServer({ openBrowser: false, port: 0 });
  try {
    const gameA = await openSocket(server.port);
    const gameB = await openSocket(server.port);
    const sessionAPromise = nextMatch(gameA, (message) => message.type === 'SESSION');
    const sessionBPromise = nextMatch(gameB, (message) => message.type === 'SESSION');
    gameA.send(JSON.stringify({ type: 'HOST' }));
    gameB.send(JSON.stringify({ type: 'HOST' }));
    const sessionA = await sessionAPromise;
    const sessionB = await sessionBPromise;
    assert.match(sessionA.controllerUrl, /\/controller\?session=/);
    assert.notEqual(sessionA.sessionId, sessionB.sessionId);

    const phone = await openSocket(server.port);
    const paired = nextMatch(phone, (message) => message.type === 'PAIRED');
    const connected = nextMatch(gameA, (message) => message.type === 'CONTROLLER_CONNECTED');
    phone.send(JSON.stringify({ type: 'PAIR', sessionId: sessionA.sessionId, token: sessionA.token }));
    await paired;
    await connected;

    const moved = nextMatch(gameA, (message) => message.type === 'PLAYER_INPUT' && message.x === 0.5);
    const quiet = nextMatch(gameB, (message) => message.type === 'PLAYER_INPUT');
    phone.send(JSON.stringify({ type: 'MOVE', x: 0.5 }));
    assert.equal((await moved).fire, false);
    const leaked = await Promise.race([
      quiet.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 250)),
    ]);
    assert.equal(leaked, false);

    const clamped = nextMatch(gameA, (message) => message.type === 'PLAYER_INPUT' && message.fire === true);
    phone.send('nope');
    phone.send(JSON.stringify({ type: 'MOVE', x: 9 }));
    phone.send(JSON.stringify({ type: 'FIRE', pressed: true }));
    const fired = await clamped;
    assert.equal(fired.x, 1);

    const special = nextMatch(gameA, (message) => message.type === 'SPECIAL_ATTACK');
    phone.send(JSON.stringify({ type: 'SPECIAL' }));
    await special;

    const intruder = await openSocket(server.port);
    const rejected = nextMatch(intruder, (message) => message.type === 'ERROR');
    intruder.send(JSON.stringify({ type: 'PAIR', sessionId: sessionA.sessionId, token: sessionA.token }));
    assert.equal((await rejected).code, 'CONTROLLER_TAKEN');

    const wrong = await openSocket(server.port);
    const bad = nextMatch(wrong, (message) => message.type === 'ERROR');
    wrong.send(JSON.stringify({ type: 'PAIR', sessionId: sessionA.sessionId, token: 'nope' }));
    assert.equal((await bad).code, 'BAD_SESSION');

    const dropped = nextMatch(gameA, (message) => message.type === 'CONTROLLER_DISCONNECTED');
    phone.close();
    await dropped;
    intruder.close();
    wrong.close();
    gameA.close();
    gameB.close();
  } finally {
    await server.close();
  }
});

test('a fresh HOST retires the old session and its phone', { timeout: 30000 }, async () => {
  const server = await startServer({ openBrowser: false, port: 0 });
  try {
    const game = await openSocket(server.port);
    const first = nextMatch(game, (m) => m.type === 'SESSION');
    game.send(JSON.stringify({ type: 'HOST' }));
    const old = await first;
    const phone = await openSocket(server.port);
    const paired = nextMatch(phone, (m) => m.type === 'PAIRED');
    phone.send(JSON.stringify({ type: 'PAIR', sessionId: old.sessionId, token: old.token }));
    await paired;

    const ended = nextMatch(phone, (m) => m.type === 'ERROR' && m.code === 'SESSION_ENDED');
    const second = nextMatch(game, (m) => m.type === 'SESSION');
    game.send(JSON.stringify({ type: 'HOST' }));
    assert.notEqual((await second).sessionId, old.sessionId);
    await ended;

    const retry = await openSocket(server.port);
    const refused = nextMatch(retry, (m) => m.type === 'ERROR');
    retry.send(JSON.stringify({ type: 'PAIR', sessionId: old.sessionId, token: old.token }));
    assert.equal((await refused).code, 'BAD_SESSION');
    retry.close();
    game.close();
  } finally {
    await server.close();
  }
});

test('hosted split: plain HTTP, QR points at the frontend, foreign origins refused', { timeout: 30000 }, async () => {
  const server = await startServer({
    openBrowser: false,
    port: 0,
    tls: false,
    production: true,
    frontendUrl: 'https://space-dodger.example/',
  });
  const connect = (origin) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, { origin });
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
  try {
    const health = await fetch(`http://127.0.0.1:${server.port}/health`).then((r) => r.json());
    assert.equal(health.ok, true);
    await assert.rejects(connect('https://evil.example'), /401/);
    const game = await connect('https://space-dodger.example');
    const session = nextMatch(game, (m) => m.type === 'SESSION');
    game.send(JSON.stringify({ type: 'HOST' }));
    const { controllerUrl, reachable } = await session;
    assert.match(controllerUrl, /^https:\/\/space-dodger\.example\/controller\?session=/);
    assert.equal(reachable, true);
    game.close();
  } finally {
    await server.close();
  }
});
