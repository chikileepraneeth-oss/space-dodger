const KEY = 'space-dodger-audio';

function loadSettings() {
  try {
    return { volume: 0.7, music: true, muted: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { volume: 0.7, music: true, muted: false };
  }
}

// Original synthesized sounds: [wave, startHz, endHz, seconds, gain, noise?]
const SOUNDS = {
  laser: ['square', 1500, 320, 0.08, 0.05],
  enemyShot: ['sawtooth', 520, 180, 0.12, 0.035],
  hit: ['triangle', 300, 120, 0.06, 0.08, true],
  rock: ['sine', 160, 50, 0.3, 0.25, true],
  explode: ['sine', 120, 35, 0.6, 0.4, true],
  damage: ['sawtooth', 240, 60, 0.4, 0.22, true],
  shield: ['sine', 900, 400, 0.25, 0.15],
  launch: ['sine', 220, 1300, 0.3, 0.15],
  nova: ['sine', 90, 25, 1.1, 0.6, true],
  empty: ['square', 180, 160, 0.08, 0.06],
};

// A slow, original A-minor progression for the background loop.
const BASS = [45, 45, 41, 43];
const ARP = [0, 3, 7, 12, 7, 3, 10, 7];

export class AudioManager {
  constructor() {
    this.settings = loadSettings();
    this.ctx = null;
    this.lastPlayed = {};
  }

  /** Browsers only allow audio after a click, so call this from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, len);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      this.apply();
      this.startMusic();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      /* Settings last for this page only. */
    }
    this.apply();
  }

  apply() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.volume, now, 0.05);
    this.musicGain.gain.setTargetAtTime(this.settings.music ? (this.ducked ? 0.12 : 0.35) : 0, now, 0.2);
  }

  setVolume(v) { this.settings.volume = v; this.save(); }
  setMuted(m) { this.settings.muted = m; this.save(); }
  setMusic(on) { this.settings.music = on; this.save(); }
  duck(on) { this.ducked = on; this.apply(); }

  play(name) {
    const spec = SOUNDS[name];
    if (!this.ctx || !spec || this.settings.muted) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlayed[name] || 0) < 0.03) return;
    this.lastPlayed[name] = now;
    const [wave, from, to, dur, gain, noisy] = spec;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    env.connect(this.master);

    const osc = this.ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + dur);
    osc.connect(env);
    osc.start(now);
    osc.stop(now + dur + 0.02);

    if (noisy) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + dur);
      src.connect(filter).connect(env);
      src.start(now, Math.random() * 0.5);
      src.stop(now + dur + 0.02);
    }
  }

  chime(notes, step = 0.07, wave = 'sine') {
    if (!this.ctx || this.settings.muted) return;
    const now = this.ctx.currentTime;
    notes.forEach((hz, i) => {
      const t = now + i * step;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.14, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + step * 2.4);
      env.connect(this.master);
      const osc = this.ctx.createOscillator();
      osc.type = wave;
      osc.frequency.value = hz;
      osc.connect(env);
      osc.start(t);
      osc.stop(t + step * 2.5);
    });
  }

  powerUp() { this.chime([523, 659, 784, 1047]); }
  alarm() { this.chime([880, 660, 880, 660, 880, 660], 0.16, 'square'); }
  gameOver() { this.chime([440, 370, 311, 220], 0.22, 'triangle'); }

  /** Look-ahead sequencer: every 100 ms, schedule the notes that fall in the next 250 ms. */
  startMusic() {
    const beat = 60 / 96 / 2;
    let step = 0;
    let next = this.ctx.currentTime + 0.1;
    const note = (midi, t, len, type, gain) => {
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, t + len);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = type === 'sawtooth' ? 700 : 2400;
      env.connect(filter).connect(this.musicGain);
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      osc.connect(env);
      osc.start(t);
      osc.stop(t + len + 0.05);
    };
    setInterval(() => {
      if (!this.settings.music || this.ctx.state !== 'running') {
        next = this.ctx.currentTime + 0.1;
        return;
      }
      while (next < this.ctx.currentTime + 0.25) {
        const bar = Math.floor(step / 16) % BASS.length;
        const root = BASS[bar];
        if (step % 8 === 0) note(root, next, beat * 7.5, 'sawtooth', 0.12);
        note(root + 24 + ARP[step % ARP.length], next, beat * 0.9, 'triangle', 0.05);
        step += 1;
        next += beat;
      }
    }, 100);
  }
}
