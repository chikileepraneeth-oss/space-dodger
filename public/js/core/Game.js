import { GameSocket } from '../network.js';
import { InputSystem } from '../systems/InputSystem.js';
import { AudioManager } from './AudioManager.js';
import { CameraManager } from './CameraManager.js';
import { SceneManager } from './SceneManager.js';
import { World } from './World.js';
import { Player } from '../entities/Player.js';
import { SpaceEnvironment } from '../environment/SpaceEnvironment.js';
import { StarField } from '../environment/StarField.js';
import { GameOver } from '../ui/GameOver.js';
import { HUD } from '../ui/HUD.js';
import { MainMenu } from '../ui/MainMenu.js';
import { PairingScreen } from '../ui/PairingScreen.js';
import { PauseMenu } from '../ui/PauseMenu.js';

const STORAGE_KEY = 'space-dodger-session';
const QUALITY_KEY = 'space-dodger-quality';
const GAME_OVER_DELAY = 1.6;
const RETRY_GUARD_MS = 1500;

function readQuality() {
  try {
    return localStorage.getItem(QUALITY_KEY) === 'low' ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

/**
 * App states: menu → pairing → playing ⇄ paused → over.
 * Overlays are derived from (state, controller connection) in render().
 */
export class Game {
  constructor(root) {
    const ui = root.querySelector('#ui');
    this.audio = new AudioManager();
    this.input = new InputSystem();
    this.quality = readQuality();
    this.sceneManager = new SceneManager(root.querySelector('canvas'));
    this.sceneManager.setQuality(this.quality);
    const { scene } = this.sceneManager;
    this.player = new Player();
    scene.add(this.player.object);
    this.camera = new CameraManager(this.sceneManager.camera, this.player);
    this.stars = new StarField(scene);
    this.environment = new SpaceEnvironment(scene);
    this.world = new World(scene, {
      player: this.player,
      camera: this.camera,
      audio: this.audio,
      emit: (type, data) => this.onWorldEvent(type, data),
    });

    this.hud = new HUD(ui, { onPause: () => this.togglePause() });
    this.menu = new MainMenu(ui, {
      audio: this.audio,
      quality: this.quality,
      onPlay: () => this.play(),
      onConnect: () => this.setState('pairing'),
      onQuality: (q) => this.setQuality(q),
    });
    this.pairing = new PairingScreen(ui, { onStart: () => this.startRun(), onBack: () => this.setState('menu') });
    this.pauseMenu = new PauseMenu(ui, {
      onResume: () => this.resume(),
      onRestart: () => this.startRun(),
      onMenu: () => this.toMenu(),
    });
    this.gameOver = new GameOver(ui, {
      onRetry: () => this.startRun(),
      onMenu: () => this.toMenu(),
      onReconnect: () => this.newSession(),
    });

    this.state = 'menu';
    this.connected = false;
    this.serverDown = false;
    this.prevFire = false;
    this.overTimer = 0;
    this.overAt = 0;

    this.socket = new GameSocket({
      onOpen: () => {
        this.serverDown = false;
        this.host();
      },
      onMessage: (message) => this.onMessage(message),
      onClose: () => {
        this.serverDown = true;
        this.pairing.setStatus('Server unreachable. Reconnecting…');
        if (this.state === 'playing') this.setState('paused');
        this.render();
      },
    });

    // Audio may only start after a click on this page; any click counts.
    window.addEventListener('pointerdown', () => this.audio.unlock());
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || event.key === 'p') this.togglePause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.setState('paused');
    });
    this.last = performance.now();
  }

  start() {
    this.render();
    this.socket.connect();
    requestAnimationFrame(this.frame);
  }

  get canPlay() {
    return this.connected || this.input.debug;
  }

  host() {
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      saved = null;
    }
    this.socket.send(saved ? { type: 'HOST', sessionId: saved.sessionId, token: saved.token } : { type: 'HOST' });
  }

  /** New QR code and token. The server drops the old session so its phone can no longer steer. */
  newSession() {
    sessionStorage.removeItem(STORAGE_KEY);
    this.setConnected(false);
    this.world.reset();
    this.socket.send({ type: 'HOST' });
    this.setState('pairing');
  }

  onMessage(message) {
    switch (message.type) {
      case 'SESSION':
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: message.sessionId, token: message.hostToken }));
        this.pairing.showSession(message);
        this.setConnected(Boolean(message.controllerConnected));
        break;
      case 'ERROR':
        if (message.code === 'BAD_SESSION') {
          sessionStorage.removeItem(STORAGE_KEY);
          this.socket.send({ type: 'HOST' });
        }
        break;
      case 'CONTROLLER_CONNECTED':
        this.setConnected(true);
        break;
      case 'CONTROLLER_DISCONNECTED':
        this.setConnected(false);
        if (this.state === 'playing') this.setState('paused');
        break;
      case 'PLAYER_INPUT':
        this.input.setMove(message.x);
        this.input.fire = message.fire === true;
        break;
      case 'SPECIAL_ATTACK':
        if (this.state === 'playing') this.world.special();
        break;
      case 'PAUSE':
        this.togglePause();
        break;
      default:
        break;
    }
  }

  setConnected(connected) {
    this.connected = connected;
    this.input.connected = connected;
    if (!connected) {
      this.input.fire = false;
      this.input.setMove(0);
    }
    this.render();
  }

  setState(state) {
    this.state = state;
    this.render();
  }

  /** One place decides which overlay is visible. */
  render() {
    const { state } = this;
    const lost = state === 'paused' && !this.canPlay;
    this.menu.toggle(state === 'menu');
    this.menu.update({ connected: this.connected, debug: this.input.debug, best: this.world.score.best });
    this.pairing.toggle(state === 'pairing' || lost);
    if (!this.serverDown) this.pairing.setMode(lost ? 'lost' : this.connected ? 'connected' : 'waiting');
    this.pauseMenu.toggle(state === 'paused' && !lost, this.connected ? 'Press Pause on the phone to resume.' : 'Click Resume to continue.');
    this.gameOver.toggle(state === 'over');
    this.hud.toggle(state === 'playing' || state === 'paused');
    this.hud.setConnected(this.connected, this.input.debug);
    this.input.paused = state === 'paused';
    this.audio.duck(state !== 'playing');
  }

  play() {
    this.audio.unlock();
    if (this.canPlay) this.startRun();
    else this.setState('pairing');
  }

  startRun() {
    if (!this.canPlay) {
      this.setState('pairing');
      return;
    }
    this.audio.unlock();
    this.world.reset();
    this.overTimer = 0;
    this.setState('playing');
    this.hud.banner('Wave 1');
  }

  resume() {
    if (this.state !== 'paused') return;
    if (!this.canPlay) return;
    this.setState('playing');
  }

  togglePause() {
    if (this.state === 'playing') this.setState('paused');
    else if (this.state === 'paused') this.resume();
  }

  toMenu() {
    this.world.reset();
    this.setState('menu');
  }

  setQuality(quality) {
    this.quality = quality;
    this.sceneManager.setQuality(quality);
    try {
      localStorage.setItem(QUALITY_KEY, quality);
    } catch {
      /* ignore */
    }
  }

  onWorldEvent(type, data) {
    if (type === 'banner') this.hud.banner(data);
    if (type === 'toast') this.hud.toast(data);
    if (type === 'hurt') this.hud.hurt();
    if (type === 'dead') this.overTimer = GAME_OVER_DELAY;
  }

  /** The phone has no "start" button: a fresh Fire press starts or retries. */
  onFirePress() {
    if (this.state === 'menu' || (this.state === 'pairing' && this.canPlay)) this.startRun();
    else if (this.state === 'over' && performance.now() - this.overAt > RETRY_GUARD_MS) this.startRun();
  }

  finishRun() {
    const isBest = this.world.score.finish();
    this.gameOver.fill(this.world.snapshot(), isBest);
    this.audio.gameOver();
    this.overAt = performance.now();
    this.setState('over');
  }

  frame = (now) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    const fire = this.input.fire;
    if (fire && !this.prevFire) this.onFirePress();
    this.prevFire = fire;
    if (this.input.takeSpecial() && this.state === 'playing') this.world.special();

    this.player.update(dt, this.input);
    if (this.state === 'playing') {
      this.world.update(dt, this.input);
      this.hud.update(this.world.snapshot());
      if (this.overTimer > 0) {
        this.overTimer -= dt;
        if (this.overTimer <= 0) this.finishRun();
      }
    } else if (this.state === 'over') {
      this.world.effects.update(dt);
    }
    const frozen = this.state === 'paused';
    if (!frozen) this.camera.update(dt);
    this.stars.update(dt, frozen);
    this.environment.update(dt, frozen);
    this.sceneManager.render();
    requestAnimationFrame(this.frame);
  };
}
