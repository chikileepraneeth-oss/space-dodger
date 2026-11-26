/**
 * Everything collides on the y = 0 plane. Fast lasers can skip past a meteor in one
 * frame, so z is tested as a swept interval: the z gap between the two entities moves
 * linearly from (prevZ difference) to (current difference) during the frame, and they
 * touched if that range crosses [-r, r]. x uses the current positions.
 */
export function hits(a, b) {
  const r = a.radius + b.radius;
  const pa = a.object.position;
  const pb = b.object.position;
  if (Math.abs(pa.x - pb.x) > r) return false;
  const now = pa.z - pb.z;
  const before = (a.prevZ ?? pa.z) - (b.prevZ ?? pb.z);
  return Math.min(now, before) <= r && Math.max(now, before) >= -r;
}

export function within(a, x, z, radius) {
  const p = a.object.position;
  return (p.x - x) ** 2 + (p.z - z) ** 2 <= (radius + a.radius) ** 2;
}

/** Runs every gameplay pair once per frame and reports contacts to the world. */
export class CollisionSystem {
  run(world) {
    const { player, meteors, enemies, lasers, bolts, powerUps, torpedo } = world;

    for (const laser of lasers.items) {
      if (!laser.active) continue;
      const meteor = meteors.find((m) => hits(laser, m));
      if (meteor) {
        lasers.release(laser);
        world.damageMeteor(meteor, laser.damage);
        continue;
      }
      const enemy = enemies.find((e) => hits(laser, e));
      if (enemy) {
        lasers.release(laser);
        world.damageEnemy(enemy, laser.damage);
      }
    }

    if (torpedo.active && (meteors.find((m) => hits(torpedo, m)) || enemies.find((e) => hits(torpedo, e)))) {
      world.detonate();
    }

    for (const bolt of bolts.items) {
      if (bolt.active && hits(bolt, player)) {
        bolts.release(bolt);
        world.hurtPlayer();
      }
    }

    for (const meteor of meteors.items) {
      if (meteor.active && hits(meteor, player)) {
        world.hurtPlayer();
        world.destroyMeteor(meteor, false);
      }
    }

    for (const enemy of enemies.items) {
      if (enemy.active && enemy.type !== 'boss' && hits(enemy, player)) {
        world.hurtPlayer();
        world.destroyEnemy(enemy, false);
      }
    }

    for (const powerUp of powerUps.items) {
      if (powerUp.active && hits(powerUp, player)) world.collect(powerUp);
    }
  }
}
