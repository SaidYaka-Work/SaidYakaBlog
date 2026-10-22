/**
 * R3F constructs THREE.Clock on Canvas mount. Clock has been deprecated since
 * r183 in favor of Timer. Swap the constructor so Fiber never touches Clock.
 */
import * as THREE from 'three';
import { Timer } from 'three';

class TimerClock {
  autoStart: boolean;
  running = false;
  startTime = 0;
  oldTime = 0;
  elapsedTime = 0;
  private readonly timer = new Timer();

  constructor(autoStart = true) {
    this.autoStart = autoStart;
    if (typeof document !== 'undefined') this.timer.connect(document);
    if (autoStart) this.start();
  }

  start() {
    this.timer.reset();
    this.startTime = performance.now();
    this.oldTime = this.startTime;
    this.elapsedTime = 0;
    this.running = true;
  }

  stop() {
    this.running = false;
    this.autoStart = false;
  }

  getElapsedTime() {
    this.getDelta();
    return this.elapsedTime;
  }

  getDelta() {
    if (this.autoStart && !this.running) {
      this.start();
      return 0;
    }
    if (!this.running) return 0;
    this.timer.update();
    const delta = this.timer.getDelta();
    this.elapsedTime = this.timer.getElapsed();
    this.oldTime = performance.now();
    return delta;
  }
}

const three = THREE as typeof THREE & { Clock: typeof TimerClock };
three.Clock = TimerClock;
