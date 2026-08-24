import * as THREE from 'three';

export enum AnimationState {
  IDLE = 'idle',
  WALK = 'walk',
  RUN = 'run',
  SPRINT = 'sprint',
  JUMP = 'jump',
  FALL = 'fall',
  LAND = 'land',
  ATTACK = 'attack',
  HEAVY_ATTACK = 'heavy_attack',
  BLOCK = 'block',
  PARRY = 'parry',
  DODGE = 'dodge',
  HIT = 'hit',
  STUN = 'stun',
  CAST = 'cast',
  INTERACT = 'interact',
  USE_ITEM = 'use_item',
  SPECIAL = 'special',
  DEATH = 'death',
  RESPAWN = 'respawn',
}

export enum AnimationPriority {
  LOW = 0,       // idle, walk, run
  NORMAL = 1,    // jump, fall, interact
  HIGH = 2,      // attack, block, dodge
  CRITICAL = 3,  // hit, stun, death
  FORCED = 4,    // forced transitions (respawning, etc.)
}

export interface AnimationClip {
  name: string;
  duration: number;
  loop: boolean;
  priority: AnimationPriority;
  speed: number;
  events?: AnimationEvent[];
}

export interface AnimationEvent {
  time: number; // normalized 0-1
  type: 'damage' | 'sound' | 'vfx' | 'spawn' | 'custom';
  data?: Record<string, unknown>;
}

export interface AnimationTransition {
  from: AnimationState;
  to: AnimationState;
  duration: number;
  condition?: (context: AnimationContext) => boolean;
}

export interface AnimationContext {
  velocity: THREE.Vector3;
  onGround: boolean;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  isAttacking: boolean;
  isBlocking: boolean;
  isDodging: boolean;
  isCasting: boolean;
  isInteracting: boolean;
  isSprinting: boolean;
  lastDamageTime: number;
  customFlags: Map<string, boolean>;
}

export interface AnimationStateData {
  clip: AnimationClip;
  weight: number;
  time: number;
  playing: boolean;
  layer: number;
}

export class AnimationStateMachine {
  private currentState: AnimationState = AnimationState.IDLE;
  private previousState: AnimationState = AnimationState.IDLE;
  private stateData: Map<AnimationState, AnimationStateData> = new Map();
  private transitions: Map<string, AnimationTransition[]> = new Map();
  private crossFadeTime = 0;
  private crossFadeDuration = 0;
  private crossFadeFrom: AnimationStateData | null = null;
  private context: AnimationContext;
  private mixer: THREE.AnimationMixer | null = null;
  private clips: Map<AnimationState, THREE.AnimationClip> = new Map();
  private actions: Map<AnimationState, THREE.AnimationAction> = new Map();

  constructor() {
    this.context = this.createDefaultContext();
    this.setupDefaultTransitions();
  }

  private createDefaultContext(): AnimationContext {
    return {
      velocity: new THREE.Vector3(),
      onGround: true,
      health: 100,
      maxHealth: 100,
      stamina: 100,
      maxStamina: 100,
      isAttacking: false,
      isBlocking: false,
      isDodging: false,
      isCasting: false,
      isInteracting: false,
      isSprinting: false,
      lastDamageTime: 0,
      customFlags: new Map(),
    };
  }

  private setupDefaultTransitions(): void {
    const defaultTransitions: AnimationTransition[] = [
      { from: AnimationState.IDLE, to: AnimationState.WALK, duration: 0.2 },
      { from: AnimationState.IDLE, to: AnimationState.RUN, duration: 0.2 },
      { from: AnimationState.IDLE, to: AnimationState.JUMP, duration: 0.1 },
      { from: AnimationState.IDLE, to: AnimationState.ATTACK, duration: 0.1 },
      { from: AnimationState.IDLE, to: AnimationState.BLOCK, duration: 0.05 },
      { from: AnimationState.IDLE, to: AnimationState.DODGE, duration: 0.05 },
      { from: AnimationState.IDLE, to: AnimationState.HIT, duration: 0.1 },
      { from: AnimationState.IDLE, to: AnimationState.DEATH, duration: 0.3 },
      { from: AnimationState.WALK, to: AnimationState.IDLE, duration: 0.2 },
      { from: AnimationState.WALK, to: AnimationState.RUN, duration: 0.15 },
      { from: AnimationState.WALK, to: AnimationState.JUMP, duration: 0.1 },
      { from: AnimationState.WALK, to: AnimationState.ATTACK, duration: 0.15 },
      { from: AnimationState.WALK, to: AnimationState.HIT, duration: 0.1 },
      { from: AnimationState.RUN, to: AnimationState.WALK, duration: 0.15 },
      { from: AnimationState.RUN, to: AnimationState.IDLE, duration: 0.2 },
      { from: AnimationState.RUN, to: AnimationState.JUMP, duration: 0.1 },
      { from: AnimationState.RUN, to: AnimationState.SPRINT, duration: 0.1 },
      { from: AnimationState.RUN, to: AnimationState.ATTACK, duration: 0.15 },
      { from: AnimationState.RUN, to: AnimationState.HIT, duration: 0.1 },
      { from: AnimationState.SPRINT, to: AnimationState.RUN, duration: 0.1 },
      { from: AnimationState.SPRINT, to: AnimationState.IDLE, duration: 0.2 },
      { from: AnimationState.JUMP, to: AnimationState.FALL, duration: 0.05, condition: (ctx) => ctx.velocity.y < 0 },
      { from: AnimationState.FALL, to: AnimationState.LAND, duration: 0.1, condition: (ctx) => ctx.onGround },
      { from: AnimationState.LAND, to: AnimationState.IDLE, duration: 0.2 },
      { from: AnimationState.ATTACK, to: AnimationState.IDLE, duration: 0.2 },
      { from: AnimationState.ATTACK, to: AnimationState.WALK, duration: 0.15 },
      { from: AnimationState.ATTACK, to: AnimationState.RUN, duration: 0.15 },
      { from: AnimationState.HEAVY_ATTACK, to: AnimationState.IDLE, duration: 0.3 },
      { from: AnimationState.BLOCK, to: AnimationState.IDLE, duration: 0.15 },
      { from: AnimationState.BLOCK, to: AnimationState.PARRY, duration: 0.05 },
      { from: AnimationState.PARRY, to: AnimationState.IDLE, duration: 0.2 },
      { from: AnimationState.DODGE, to: AnimationState.IDLE, duration: 0.2 },
      { from: AnimationState.DODGE, to: AnimationState.RUN, duration: 0.15 },
      { from: AnimationState.HIT, to: AnimationState.IDLE, duration: 0.3 },
      { from: AnimationState.HIT, to: AnimationState.DEATH, duration: 0.3, condition: (ctx) => ctx.health <= 0 },
      { from: AnimationState.STUN, to: AnimationState.IDLE, duration: 0.3 },
      { from: AnimationState.CAST, to: AnimationState.IDLE, duration: 0.2 },
      { from: AnimationState.INTERACT, to: AnimationState.IDLE, duration: 0.2 },
      { from: AnimationState.USE_ITEM, to: AnimationState.IDLE, duration: 0.15 },
      { from: AnimationState.SPECIAL, to: AnimationState.IDLE, duration: 0.3 },
      { from: AnimationState.DEATH, to: AnimationState.RESPAWN, duration: 1.0 },
      { from: AnimationState.RESPAWN, to: AnimationState.IDLE, duration: 0.5 },
    ];

    for (const transition of defaultTransitions) {
      this.addTransition(transition);
    }
  }

  addTransition(transition: AnimationTransition): void {
    const key = `${transition.from}->${transition.to}`;
    if (!this.transitions.has(key)) {
      this.transitions.set(key, []);
    }
    this.transitions.get(key)!.push(transition);
  }

  setMixer(mixer: THREE.AnimationMixer): void {
    this.mixer = mixer;
  }

  registerClip(state: AnimationState, clip: THREE.AnimationClip, priority: AnimationPriority, loop = true, speed = 1): void {
    this.clips.set(state, clip);
    if (this.mixer) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.timeScale = speed;
      this.actions.set(state, action);
    }

    this.stateData.set(state, {
      clip: { name: state, duration: clip.duration, loop, priority, speed },
      weight: 0,
      time: 0,
      playing: false,
      layer: priority,
    });
  }

  updateContext(partial: Partial<AnimationContext>): void {
    this.context = { ...this.context, ...partial };
  }

  getContext(): AnimationContext {
    return { ...this.context };
  }

  getCurrentState(): AnimationState {
    return this.currentState;
  }

  getPreviousState(): AnimationState {
    return this.previousState;
  }

  canTransition(from: AnimationState, to: AnimationState): boolean {
    const key = `${from}->${to}`;
    const transitions = this.transitions.get(key);
    if (!transitions || transitions.length === 0) return false;

    for (const transition of transitions) {
      if (!transition.condition || transition.condition(this.context)) {
        return true;
      }
    }
    return false;
  }

  requestState(newState: AnimationState, force = false): boolean {
    if (newState === this.currentState) return true;

    if (force) {
      return this.forceTransition(newState);
    }

    const currentData = this.stateData.get(this.currentState);
    const newData = this.stateData.get(newState);

    if (!newData) {
      console.warn(`Animation state ${newState} not registered`);
      return false;
    }

    if (!this.canTransition(this.currentState, newState)) {
      return false;
    }

    if (currentData && currentData.clip.priority > newData.clip.priority) {
      return false;
    }

    return this.initiateTransition(newState);
  }

  private initiateTransition(newState: AnimationState): boolean {
    const newData = this.stateData.get(newState);
    const currentData = this.stateData.get(this.currentState);

    if (!newData) return false;

    const transitionKey = `${this.currentState}->${newState}`;
    const transitions = this.transitions.get(transitionKey);
    let transitionDuration = 0.2;

    if (transitions && transitions.length > 0) {
      transitionDuration = transitions[0].duration;
    }

    this.crossFadeDuration = transitionDuration;
    this.crossFadeTime = 0;
    this.crossFadeFrom = currentData ? { ...currentData } : null;
    this.previousState = this.currentState;
    this.currentState = newState;

    if (this.mixer && this.actions.has(newState)) {
      const newAction = this.actions.get(newState)!;
      newAction.reset();
      newAction.setEffectiveWeight(0);
      newAction.play();

      if (currentData && this.actions.has(this.previousState)) {
        const oldAction = this.actions.get(this.previousState)!;
        oldAction.crossFadeTo(newAction, transitionDuration, false);
      } else {
        newAction.setEffectiveWeight(1);
      }
    }

    newData.playing = true;
    newData.weight = 0;
    newData.time = 0;

    return true;
  }

  private forceTransition(newState: AnimationState): boolean {
    const newData = this.stateData.get(newState);
    if (!newData) return false;

    this.crossFadeDuration = 0.1;
    this.crossFadeTime = 0;
    this.crossFadeFrom = this.stateData.get(this.currentState) ? { ...this.stateData.get(this.currentState)! } : null;
    this.previousState = this.currentState;
    this.currentState = newState;

    if (this.mixer && this.actions.has(newState)) {
      const newAction = this.actions.get(newState)!;
      newAction.reset();
      newAction.setEffectiveWeight(1);
      newAction.play();

      if (this.crossFadeFrom && this.actions.has(this.previousState)) {
        const oldAction = this.actions.get(this.previousState)!;
        oldAction.stop();
      }
    }

    newData.playing = true;
    newData.weight = 1;
    newData.time = 0;

    return true;
  }

  update(deltaTime: number): void {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    const currentData = this.stateData.get(this.currentState);
    if (currentData) {
      currentData.time += deltaTime;
      if (currentData.time >= currentData.clip.duration) {
        if (currentData.clip.loop) {
          currentData.time = currentData.time % currentData.clip.duration;
        } else {
          currentData.playing = false;
          this.onAnimationComplete(this.currentState);
        }
      }
    }

    if (this.crossFadeTime < this.crossFadeDuration) {
      this.crossFadeTime += deltaTime;
      const progress = Math.min(this.crossFadeTime / this.crossFadeDuration, 1);

      if (currentData) {
        currentData.weight = progress;
      }

      if (this.crossFadeFrom) {
        this.crossFadeFrom.weight = 1 - progress;
      }

      if (progress >= 1) {
        this.crossFadeFrom = null;
        if (currentData) currentData.weight = 1;
      }
    }

    this.processAutoTransitions();
  }

  private processAutoTransitions(): void {
    if (this.crossFadeFrom !== null) return;

    const velocity = this.context.velocity;
    const speed = new THREE.Vector2(velocity.x, velocity.z).length();
    const onGround = this.context.onGround;

    if (this.context.health <= 0 && this.currentState !== AnimationState.DEATH) {
      this.requestState(AnimationState.DEATH);
      return;
    }

    if (this.currentState === AnimationState.HIT && !this.stateData.get(AnimationState.HIT)?.playing) {
      this.requestState(this.context.health <= 0 ? AnimationState.DEATH : AnimationState.IDLE);
      return;
    }

    if (this.currentState === AnimationState.ATTACK && !this.stateData.get(AnimationState.ATTACK)?.playing) {
      this.requestState(this.getMovementState(speed));
      return;
    }

    if (this.currentState === AnimationState.JUMP && velocity.y < 0) {
      this.requestState(AnimationState.FALL);
      return;
    }

    if (this.currentState === AnimationState.FALL && onGround) {
      this.requestState(AnimationState.LAND);
      return;
    }

    if (this.currentState === AnimationState.LAND && !this.stateData.get(AnimationState.LAND)?.playing) {
      this.requestState(this.getMovementState(speed));
      return;
    }

    if (this.currentState === AnimationState.DODGE && !this.stateData.get(AnimationState.DODGE)?.playing) {
      this.requestState(this.getMovementState(speed));
      return;
    }

    if (this.currentState === AnimationState.BLOCK && !this.context.isBlocking) {
      this.requestState(this.getMovementState(speed));
      return;
    }

    const movementState = this.getMovementState(speed);
    if (this.isLocomotionState(this.currentState) && movementState !== this.currentState) {
      this.requestState(movementState);
    }
  }

  private getMovementState(speed: number): AnimationState {
    if (!this.context.onGround) {
      return this.context.velocity.y > 0 ? AnimationState.JUMP : AnimationState.FALL;
    }

    if (this.context.isSprinting && speed > 0) {
      return AnimationState.SPRINT;
    }

    if (speed > 2) {
      return AnimationState.RUN;
    }

    if (speed > 0.5) {
      return AnimationState.WALK;
    }

    return AnimationState.IDLE;
  }

  private isLocomotionState(state: AnimationState): boolean {
    return [AnimationState.IDLE, AnimationState.WALK, AnimationState.RUN, AnimationState.SPRINT].includes(state);
  }

  private onAnimationComplete(state: AnimationState): void {
    const stateData = this.stateData.get(state);
    if (stateData && !stateData.clip.loop) {
      if (state === AnimationState.DEATH) {
        this.requestState(AnimationState.RESPAWN, true);
      }
    }
  }

  getStateData(state: AnimationState): AnimationStateData | undefined {
    return this.stateData.get(state);
  }

  getAllStates(): AnimationState[] {
    return Array.from(this.stateData.keys());
  }

  isPlaying(state: AnimationState): boolean {
    return this.stateData.get(state)?.playing ?? false;
  }

  getCurrentWeight(): number {
    return this.stateData.get(this.currentState)?.weight ?? 0;
  }

  dispose(): void {
    this.stateData.clear();
    this.transitions.clear();
    this.clips.clear();
    this.actions.clear();
    this.mixer = null;
  }
}

export class AnimationController {
  private stateMachine: AnimationStateMachine;
  private model: THREE.Group | null = null;
  private animationClips: Map<string, THREE.AnimationClip> = new Map();

  constructor() {
    this.stateMachine = new AnimationStateMachine();
  }

  setModel(model: THREE.Group): void {
    this.model = model;
    const mixer = new THREE.AnimationMixer(model);
    this.stateMachine.setMixer(mixer);
    this.extractAnimations(model);
  }

  private extractAnimations(model: THREE.Group): void {
    model.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh && child.animations) {
        for (const clip of child.animations) {
          this.animationClips.set(clip.name, clip);
        }
      }
    });
  }

  registerAnimation(state: AnimationState, clipName: string, options?: { loop?: boolean; speed?: number; priority?: AnimationPriority }): boolean {
    const clip = this.animationClips.get(clipName);
    if (!clip) {
      console.warn(`Animation clip "${clipName}" not found for state ${state}`);
      return false;
    }

    const priority = options?.priority ?? AnimationPriority.NORMAL;
    const loop = options?.loop ?? true;
    const speed = options?.speed ?? 1;

    this.stateMachine.registerClip(state, clip, priority, loop, speed);
    return true;
  }

  setState(state: AnimationState, force = false): boolean {
    return this.stateMachine.requestState(state, force);
  }

  updateContext(partial: Partial<AnimationContext>): void {
    this.stateMachine.updateContext(partial);
  }

  getContext(): AnimationContext {
    return this.stateMachine.getContext();
  }

  getCurrentState(): AnimationState {
    return this.stateMachine.getCurrentState();
  }

  getPreviousState(): AnimationState {
    return this.stateMachine.getPreviousState();
  }

  update(deltaTime: number): void {
    this.stateMachine.update(deltaTime);
  }

  getMixer(): THREE.AnimationMixer | null {
    return this.stateMachine['mixer'] as THREE.AnimationMixer | null;
  }

  dispose(): void {
    this.stateMachine.dispose();
    this.animationClips.clear();
    this.model = null;
  }
}