import { randomBytes, randomInt } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STALE_MS = 10 * 60 * 1000;

function sessionId() {
  let id = '';
  for (let i = 0; i < 6; i += 1) id += ALPHABET[randomInt(ALPHABET.length)];
  return id;
}

export function createSessionManager() {
  const sessions = new Map();

  return {
    create() {
      let id = sessionId();
      while (sessions.has(id)) id = sessionId();
      const session = {
        id,
        // token goes in the QR code (phone pairing); hostToken stays with the PC game only.
        token: randomBytes(18).toString('hex'),
        hostToken: randomBytes(18).toString('hex'),
        game: null,
        controller: null,
        x: 0,
        fire: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      sessions.set(id, session);
      return session;
    },
    get(id) {
      return sessions.get(id) || null;
    },
    remove(id) {
      sessions.delete(id);
    },
    touch(session) {
      session.updatedAt = Date.now();
    },
    sweep() {
      const now = Date.now();
      for (const [id, session] of sessions) {
        const gameOpen = session.game && session.game.readyState === 1;
        const controllerOpen = session.controller && session.controller.readyState === 1;
        if (!gameOpen && !controllerOpen && now - session.updatedAt > STALE_MS) {
          sessions.delete(id);
        }
      }
    },
  };
}
