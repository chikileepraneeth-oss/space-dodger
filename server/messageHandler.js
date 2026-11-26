const TYPES = new Set(['HOST', 'PAIR', 'MOVE', 'FIRE', 'SPECIAL', 'PAUSE', 'HEARTBEAT']);

function optionalString(value) {
  return typeof value === 'string' ? value : '';
}

export function parseMessage(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'BAD_JSON' };
  }
  if (!data || typeof data !== 'object' || typeof data.type !== 'string' || !TYPES.has(data.type)) {
    return { ok: false, error: 'BAD_MESSAGE' };
  }
  if (data.type === 'MOVE') {
    const x = Number(data.x);
    // y is optional so older controllers that only steer sideways keep working.
    const y = data.y === undefined ? 0 : Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: 'BAD_MOVE' };
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    return { ok: true, message: { type: 'MOVE', x: clamp(x), y: clamp(y) } };
  }
  if (data.type === 'FIRE') {
    return { ok: true, message: { type: 'FIRE', pressed: data.pressed === true } };
  }
  if (data.type === 'HOST') {
    return {
      ok: true,
      message: {
        type: 'HOST',
        sessionId: optionalString(data.sessionId),
        token: optionalString(data.token),
      },
    };
  }
  if (data.type === 'PAIR') {
    if (!data.sessionId || !data.token) return { ok: false, error: 'BAD_PAIR' };
    return {
      ok: true,
      message: { type: 'PAIR', sessionId: String(data.sessionId), token: String(data.token) },
    };
  }
  return { ok: true, message: { type: data.type } };
}
