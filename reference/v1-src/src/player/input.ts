import { gameEvents } from '../core/events';

export class InputManager {
  private keys: Set<string> = new Set();
  private mouseButtons: Set<number> = new Set();
  public mouseMovement = { x: 0, y: 0 };
  public pointerLocked = false;
  private onRequestPointerLock: (() => void) | null;
  private eventListeners: { target: EventTarget; type: string; listener: (e: Event) => void }[] = [];

  constructor(onRequestPointerLock?: () => void) {
    this.onRequestPointerLock = onRequestPointerLock ?? null;
    this.addEvent(window, 'keydown', this.onKeyDown);
    this.addEvent(window, 'keyup', this.onKeyUp);
    this.addEvent(window, 'mousedown', this.onMouseDown);
    this.addEvent(window, 'mouseup', this.onMouseUp);
    this.addEvent(document, 'pointerlockchange', this.onPointerLockChange);
    this.addEvent(document, 'mousemove', this.onMouseMove);
    this.addEvent(document, 'wheel', this.onWheel);
    this.addEvent(document, 'contextmenu', this.onContextMenu);
    this.addEvent(window, 'blur', this.onBlur);
    this.addEvent(document, 'visibilitychange', this.onBlur);
  }

  private addEvent(target: EventTarget, type: string, listener: (e: Event) => void) {
    target.addEventListener(type, listener);
    this.eventListeners.push({ target, type, listener });
  }

  private onKeyDown = (e: Event) => {
    const ke = e as KeyboardEvent;
    this.keys.add(ke.code);
    if (this.pointerLocked) {
      if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','Digit1','Digit2','Digit3','Digit4','Digit5'].includes(ke.code)) {
        e.preventDefault();
      }
      gameEvents.emit('key-down', ke.code);
    }
  };

  private onKeyUp = (e: Event) => { this.keys.delete((e as KeyboardEvent).code); };

  private onMouseDown = (e: Event) => {
    const me = e as MouseEvent;
    this.mouseButtons.add(me.button);
    if (this.pointerLocked) gameEvents.emit('mouse-down', { button: me.button });
  };

  private onMouseUp = (e: Event) => { this.mouseButtons.delete((e as MouseEvent).button); };

  private onMouseMove = (e: Event) => {
    const me = e as MouseEvent;
    if (this.pointerLocked) {
      this.mouseMovement.x += me.movementX;
      this.mouseMovement.y += me.movementY;
      gameEvents.emit('mouse-move', { movementX: me.movementX, movementY: me.movementY });
    }
  };

  private onWheel = (e: Event) => {
    const we = e as WheelEvent;
    if (this.pointerLocked) gameEvents.emit('wheel', { deltaY: we.deltaY });
  };

  private onContextMenu = (e: Event) => { if (this.pointerLocked) e.preventDefault(); };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement !== null;
    if (!this.pointerLocked) this.clearInputState();
  };

  private onBlur = () => this.clearInputState();

  private clearInputState() {
    this.keys.clear();
    this.mouseButtons.clear();
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }

  requestPointerLock() {
    if (this.onRequestPointerLock) this.onRequestPointerLock();
    else {
      const canvas = document.querySelector('canvas');
      if (canvas) canvas.requestPointerLock();
    }
  }

  isKeyDown(code: string): boolean { return this.keys.has(code); }
  isMouseDown(button: number): boolean { return this.mouseButtons.has(button); }
  consumeMouseMovement() {
    const m = { x: this.mouseMovement.x, y: this.mouseMovement.y };
    this.mouseMovement.x = 0; this.mouseMovement.y = 0;
    return m;
  }

  dispose() {
    for (const { target, type, listener } of this.eventListeners) {
      target.removeEventListener(type, listener);
    }
    this.eventListeners = [];
    this.clearInputState();
  }
}