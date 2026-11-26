import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMessage } from './messageHandler.js';

test('clamps movement and rejects bad payloads', () => {
  assert.equal(parseMessage('{').ok, false);
  assert.equal(parseMessage('{"type":"NOPE"}').error, 'BAD_MESSAGE');
  assert.equal(parseMessage('{"type":"MOVE","x":"left"}').error, 'BAD_MOVE');
  assert.deepEqual(parseMessage('{"type":"MOVE","x":4}').message, { type: 'MOVE', x: 1, y: 0 });
  assert.deepEqual(parseMessage('{"type":"MOVE","x":-2.2,"y":3}').message, { type: 'MOVE', x: -1, y: 1 });
  assert.equal(parseMessage('{"type":"MOVE","x":0,"y":"up"}').error, 'BAD_MOVE');
  assert.equal(parseMessage('{"type":"FIRE","pressed":1}').message.pressed, false);
  assert.equal(parseMessage('{"type":"FIRE","pressed":true}').message.pressed, true);
  assert.equal(parseMessage('{"type":"PAIR"}').error, 'BAD_PAIR');
});
