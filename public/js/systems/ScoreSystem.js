const BEST_KEY = 'space-dodger-best';

export const POINTS = {
  meteor: { small: 50, medium: 100, large: 150 },
  enemy: { fighter: 200, heavy: 400, elite: 600, boss: 5000 },
  powerUp: 150,
  perSecond: 10,
};

function readBest(storage) {
  try {
    return Number(storage?.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export class ScoreSystem {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.best = readBest(storage);
    this.reset();
  }

  reset() {
    this.score = 0;
    this.kills = 0;
    this.time = 0;
    this.tick = 0;
  }

  update(dt) {
    this.time += dt;
    this.tick += dt;
    while (this.tick >= 1) {
      this.tick -= 1;
      this.score += POINTS.perSecond;
    }
  }

  add(points) {
    this.score += points;
  }

  kill(points) {
    this.kills += 1;
    this.score += points;
  }

  /** Saves the best score and reports whether this run beat it. */
  finish() {
    const isBest = this.score > this.best;
    if (isBest) {
      this.best = this.score;
      try {
        this.storage?.setItem(BEST_KEY, String(this.best));
      } catch {
        /* Private mode: the best score lasts for this page only. */
      }
    }
    return isBest;
  }
}
