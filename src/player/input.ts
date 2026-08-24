/**
 * Input — keyboard + pointer lock mouse. Translates raw events into intents.
 * Pure browser API wrapper; kept thin so it can be faked in tests.
 */

export interface MoveIntent {
  forward: number; // -1..1
  strafe: number; // -1..1
}

export class InputManager {
  private keys = new Set<string>();
  private dx = 0;
  private dy = 0;
  private jumpQueued = false;
  private readonly onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === 'Space') this.jumpQueued = true;
  };
  private readonly onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private readonly onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement) {
      this.dx += e.movementX;
      this.dy += e.movementY;
    }
  };

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
  }

  /** Consume accumulated mouse delta (called once per frame). */
  consumeMouseDelta(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return d;
  }

  moveIntent(): MoveIntent {
    let forward = 0;
    let strafe = 0;
    if (this.keys.has('KeyW')) forward += 1;
    if (this.keys.has('KeyS')) forward -= 1;
    if (this.keys.has('KeyD')) strafe += 1;
    if (this.keys.has('KeyA')) strafe -= 1;
    return { forward, strafe };
  }

  consumeJump(): boolean {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }
}
