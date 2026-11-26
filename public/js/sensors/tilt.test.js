import assert from 'node:assert/strict';
import test from 'node:test';
import { horizontalTiltDegrees, normalizeScreenAngle, normalizeTilt, verticalTiltDegrees } from './tilt.js';

test('maps landscape tilt onto the screen left-right axis', () => {
  assert.equal(normalizeScreenAngle(-90), 270);
  assert.equal(horizontalTiltDegrees({ gamma: 12, beta: 3 }, 0), 12);
  assert.equal(horizontalTiltDegrees({ gamma: 12, beta: 20 }, 90), 20);
  assert.equal(horizontalTiltDegrees({ gamma: 12, beta: 20 }, -90), -20);
  assert.equal(horizontalTiltDegrees({ gamma: 8, beta: 1 }, 180), -8);
});

test('calibrates a neutral hold and clamps the result', () => {
  assert.equal(normalizeTilt(10, 10, 1), 0);
  assert.equal(normalizeTilt(46, 10, 1), 1);
  assert.equal(normalizeTilt(-26, 10, 1), -1);
  assert.ok(normalizeTilt(14, 10, 1) > 0);
  assert.ok(normalizeTilt(9, 10, 1) === 0); // 1° off neutral sits inside the 2.5° dead zone
  assert.ok(normalizeTilt(6, 10, 1) < 0);
});

test('maps forward/back pitch onto the screen up-down axis', () => {
  assert.equal(verticalTiltDegrees({ gamma: 40, beta: 5 }, 90), 40);
  assert.equal(verticalTiltDegrees({ gamma: 40, beta: 5 }, 270), -40);
  assert.equal(verticalTiltDegrees({ gamma: 3, beta: 30 }, 0), -30);
  assert.equal(verticalTiltDegrees({}, 90), 0);
});
