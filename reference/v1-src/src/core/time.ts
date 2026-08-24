export class Time {
  private lastTime = 0;
  deltaTime = 0;
  elapsed = 0;

  start(now: number) {
    this.lastTime = now;
  }

  update(now: number) {
    if (this.lastTime === 0) {
      this.lastTime = now;
      this.deltaTime = 0;
      return;
    }
    this.deltaTime = Math.min((now - this.lastTime) / 1000, 0.1);
    this.elapsed += this.deltaTime;
    this.lastTime = now;
  }
}