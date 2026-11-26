export const CONFIG = {
  maxHorizontalRange: 7.5,
  movementSmoothing: 8,
  bankAngle: 0.42,
  cameraFollow: 4.5,
  cameraOffset: { y: 2.35, z: 7.2 },
  lookAhead: -16,

  // Gameplay plane: everything that can hit the player lives on y = 0.
  spawnZ: -110,
  despawnZ: 12,
  playfieldX: 9,
  playerRadius: 0.85,

  lives: 3,
  maxLives: 5,
  invulnerableTime: 1.6,

  laserSpeed: 70,
  fireInterval: 0.16,
  rapidFireInterval: 0.07,
  specialCharges: 2,
  maxSpecialCharges: 3,
  specialCooldown: 1.2,
  specialRadius: 14,

  powerUpTime: 10,
  shieldTime: 8,
};
