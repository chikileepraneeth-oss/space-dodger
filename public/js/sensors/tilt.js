export function normalizeScreenAngle(angle) {
  const value = Number(angle);
  if (!Number.isFinite(value)) return 0;
  return ((value % 360) + 360) % 360;
}

/**
 * DeviceOrientation axes stay locked to the phone, not the rotated screen.
 * gamma is left/right in portrait. In landscape the screen's left/right axis
 * is the device's beta axis, and the sign flips with the rotation direction.
 */
export function horizontalTiltDegrees(event, screenAngle) {
  const beta = Number(event?.beta);
  const gamma = Number(event?.gamma);
  const safeBeta = Number.isFinite(beta) ? beta : 0;
  const safeGamma = Number.isFinite(gamma) ? gamma : 0;
  switch (normalizeScreenAngle(screenAngle)) {
    case 90:
      return safeBeta;
    case 270:
      return -safeBeta;
    case 180:
      return -safeGamma;
    default:
      return safeGamma;
  }
}

export function normalizeTilt(degrees, neutral, sensitivity) {
  const feel = Math.max(0.4, Math.min(2.5, Number(sensitivity) || 1));
  const span = 36 / feel;
  let value = (Number(degrees) - Number(neutral || 0)) / span;
  const dead = 0.07;
  if (Math.abs(value) < dead) return 0;
  value = Math.sign(value) * ((Math.abs(value) - dead) / (1 - dead));
  return Math.max(-1, Math.min(1, value));
}

